import mongoose from 'mongoose';
import request from 'supertest';
import {
  api,
  lastEmailTo,
  signUp,
  signUpAdmin,
  startApp,
  stopApp,
  tokenFromEmail,
} from './helpers/harness.js';

let app;
beforeAll(async () => {
  app = await startApp();
});
afterAll(stopApp);

const cookieNames = (res) => (res.headers['set-cookie'] || []).map((c) => c.split('=')[0]);

describe('signup and signin', () => {
  it('creates the user, starts a session and never returns the password', async () => {
    const res = await request(app).post(api('/signup')).send({
      name: 'Asha',
      email: 'Asha@Shop.Test',
      username: 'asha',
      password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('asha@shop.test');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.user.role).toBe('user');
    expect(cookieNames(res)).toEqual(expect.arrayContaining(['accessToken', 'refreshToken']));
    expect(lastEmailTo('asha@shop.test').subject).toMatch(/verify/i);
  });

  it('ignores a role sent at signup', async () => {
    const { user } = await signUp({ role: 'admin' });
    expect(user.role).toBe('user');
  });

  it('rejects a duplicate email with 409', async () => {
    const { credentials } = await signUp();
    const res = await request(app)
      .post(api('/signup'))
      .send({ ...credentials, username: 'someoneelse' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already exists');
  });

  it('reports validation errors per field', async () => {
    const res = await request(app).post(api('/signup')).send({ email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password', 'username']));
  });

  it('signs in with the right password only', async () => {
    const { credentials } = await signUp();
    const bad = await request(app)
      .post(api('/signin'))
      .send({ email: credentials.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const good = await request(app).post(api('/signin')).send(credentials);
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toEqual(expect.any(String));
  });

  it('does not let a query operator stand in for the email', async () => {
    await signUp();
    const res = await request(app)
      .post(api('/signin'))
      .send({ email: { $gt: '' }, password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('sessions', () => {
  it('requires sign-in for the profile and accepts a bearer token', async () => {
    expect((await request(app).get(api('/profile'))).status).toBe(401);

    const { credentials } = await signUp();
    const login = await request(app).post(api('/signin')).send(credentials);
    const res = await request(app)
      .get(api('/profile'))
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(credentials.email);
  });

  it('rotates the refresh token and rejects the old one', async () => {
    const { credentials } = await signUp();
    const login = await request(app).post(api('/signin')).send(credentials);
    const oldCookie = login.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));

    const first = await request(app).post(api('/token/refresh')).set('Cookie', oldCookie);
    expect(first.status).toBe(200);
    expect(cookieNames(first)).toEqual(expect.arrayContaining(['accessToken', 'refreshToken']));

    const replay = await request(app).post(api('/token/refresh')).set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
  });

  it('logout ends this session; logout-all ends every session', async () => {
    const { agent, credentials } = await signUp();
    const other = request.agent(app);
    await other.post(api('/signin')).send(credentials);

    await agent.post(api('/logout'));
    expect((await agent.post(api('/token/refresh'))).status).toBe(401);
    expect((await other.post(api('/token/refresh'))).status).toBe(200);

    const third = request.agent(app);
    await third.post(api('/signin')).send(credentials);
    expect((await other.post(api('/logout-all'))).status).toBe(200);
    expect((await third.post(api('/token/refresh'))).status).toBe(401);
  });
});

describe('email verification', () => {
  it('verifies with the emailed token, once', async () => {
    const { agent, user } = await signUp();
    expect(user.isEmailVerified).toBe(false);
    const token = tokenFromEmail(lastEmailTo(user.email));

    expect((await request(app).get(api(`/email/verify/${token}`))).status).toBe(200);
    const profile = await agent.get(api('/profile'));
    expect(profile.body.data.user.isEmailVerified).toBe(true);

    expect((await request(app).get(api(`/email/verify/${token}`))).status).toBe(400);
    expect((await agent.post(api('/email/resend'))).status).toBe(400);
  });
});

describe('passwords', () => {
  it('answers forgot-password the same for unknown emails', async () => {
    const { user } = await signUp();
    const known = await request(app).post(api('/password/forgot')).send({ email: user.email });
    const unknown = await request(app)
      .post(api('/password/forgot'))
      .send({ email: 'nobody@shop.test' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('resets the password, signs out old sessions and uses the token once', async () => {
    const { agent, user, credentials } = await signUp();
    await request(app).post(api('/password/forgot')).send({ email: user.email });
    const mail = lastEmailTo(user.email);
    expect(mail.message).toContain('http://shop.test/reset/');
    const token = tokenFromEmail(mail);

    const mismatch = await request(app)
      .post(api(`/password/reset/${token}`))
      .send({ password: 'newpassword1', confirmedPassword: 'different1' });
    expect(mismatch.status).toBe(400);

    const reset = await request(app)
      .post(api(`/password/reset/${token}`))
      .send({ password: 'newpassword1', confirmedPassword: 'newpassword1' });
    expect(reset.status).toBe(200);

    expect((await agent.post(api('/token/refresh'))).status).toBe(401);
    const oldLogin = await request(app).post(api('/signin')).send(credentials);
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post(api('/signin'))
      .send({ email: user.email, password: 'newpassword1' });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app)
      .post(api(`/password/reset/${token}`))
      .send({ password: 'another12345', confirmedPassword: 'another12345' });
    expect(reuse.status).toBe(400);
  });

  it('changes the password only with the correct old one', async () => {
    const { agent, user } = await signUp();
    const wrong = await agent.put(api('/password/update')).send({
      oldPassword: 'not-the-password',
      newPassword: 'brandnew123',
      confirmNewPassword: 'brandnew123',
    });
    expect(wrong.status).toBe(400);

    const ok = await agent.put(api('/password/update')).send({
      oldPassword: 'password123',
      newPassword: 'brandnew123',
      confirmNewPassword: 'brandnew123',
    });
    expect(ok.status).toBe(200);
    const login = await request(app)
      .post(api('/signin'))
      .send({ email: user.email, password: 'brandnew123' });
    expect(login.status).toBe(200);
  });
});

describe('profile', () => {
  it('updates name and avatar, and re-verifies a changed email', async () => {
    const { agent, user } = await signUp();
    await mongoose.model('User').updateOne({ _id: user._id }, { isEmailVerified: true });

    const res = await agent
      .put(api('/profile'))
      .send({ name: 'New Name', email: 'changed@shop.test', avatar: 'data:image/png;base64,AAAA', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      name: 'New Name',
      email: 'changed@shop.test',
      isEmailVerified: false,
      role: 'user',
    });
    expect(res.body.data.user.avatar.url).toBe('https://img.test/a.png');
    expect(lastEmailTo('changed@shop.test').subject).toMatch(/verify/i);
  });
});

describe('admin user management', () => {
  it('blocks non-admins', async () => {
    const { agent } = await signUp();
    expect((await agent.get(api('/admin/users'))).status).toBe(403);
  });

  it('changes the role of the target user, not the admin', async () => {
    const admin = await signUpAdmin();
    const target = await signUp();

    const res = await admin.agent.put(api(`/admin/user/${target.user._id}`)).send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(target.user._id);
    expect(res.body.data.user.role).toBe('admin');

    const User = mongoose.model('User');
    expect((await User.findById(admin.user._id)).role).toBe('admin');
    expect((await User.findById(target.user._id)).role).toBe('admin');

    const back = await admin.agent.put(api(`/admin/user/${target.user._id}`)).send({ role: 'user' });
    expect(back.body.data.user.role).toBe('user');
    expect((await User.findById(admin.user._id)).role).toBe('admin');
  });

  it('rejects unknown roles and bad ids', async () => {
    const admin = await signUpAdmin();
    const target = await signUp();
    const bad = await admin.agent.put(api(`/admin/user/${target.user._id}`)).send({ role: 'owner' });
    expect(bad.status).toBe(400);
    expect((await admin.agent.get(api('/admin/user/not-an-id'))).status).toBe(400);
  });

  it('deletes a user and their sessions', async () => {
    const admin = await signUpAdmin();
    const target = await signUp();
    expect((await admin.agent.delete(api(`/admin/user/${target.user._id}`))).status).toBe(200);
    expect((await target.agent.post(api('/token/refresh'))).status).toBe(401);
    expect((await admin.agent.delete(api(`/admin/user/${admin.user._id}`))).status).toBe(400);
  });
});
