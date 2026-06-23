export const sendToken = (user, statusCode, res) => {
  const token = user.getJWTToken();
  const userResponse = user.toObject();
  delete userResponse.password;

  //options for cookie
  const options = {
    expires: new Date(Date.now() + parseInt(process.env.EXPIRES_COOKIE) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  };

  return res.status(statusCode).cookie('token', token, options).json({
    success: true,
    user: userResponse,
    token,
  });
};
