import Subscriber from '../models/subscriber.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getPagination, paginate } from '../utils/pagination.js';
import { sendResponse } from '../utils/apiResponse.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/sendEmail.js';

// Forwards a contact form message to the shop's own mailbox
export const sendContactMessage = asyncHandler(async (req, res) => {
  if (!config.smtp.mail) {
    // Without a mailbox the message would be lost, so say so instead of pretending
    throw new ApiError('Messages cannot be sent right now. Please email or call us instead', 503);
  }
  const { name, email, subject, message } = req.body;
  try {
    await sendEmail({
      email: config.smtp.mail,
      subject: `Contact form: ${subject}`,
      message: `From: ${name} <${email}>\n\n${message}`,
    });
  } catch (error) {
    logger.error(`Contact message from ${email} could not be sent: ${error.message}`);
    throw new ApiError('Your message could not be sent. Please try again later', 502);
  }
  sendResponse(res, 200, 'Thank you for your message. We will get back to you soon');
});

export const subscribeNewsletter = asyncHandler(async (req, res) => {
  // Subscribing twice is not an error
  await Subscriber.updateOne(
    { email: req.body.email },
    { $setOnInsert: { email: req.body.email } },
    { upsert: true }
  );
  sendResponse(res, 200, 'Thank you for subscribing');
});

export const getSubscribers = asyncHandler(async (req, res) => {
  const { items: subscribers, ...page } = await paginate(Subscriber, {}, getPagination(req.query));
  sendResponse(res, 200, 'Subscribers retrieved successfully', { subscribers, ...page });
});
