import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import config from '../config/index.js';

export const getStats = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenue, byStatus, topProducts, lowStock, totalProducts, totalUsers, newUsers] =
    await Promise.all([
      Order.aggregate([
        { $match: { paymentStatus: 'paid', orderStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { orderStatus: { $nin: ['Cancelled', 'Pending'] } } },
        { $unwind: '$orderItems' },
        {
          $group: {
            _id: '$orderItems.product',
            name: { $first: '$orderItems.name' },
            unitsSold: { $sum: '$orderItems.quantity' },
            sales: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
          },
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
      ]),
      Product.find({ stock: { $lte: config.shop.lowStockThreshold } })
        .select('name stock category')
        .sort({ stock: 1 })
        .limit(10),
      Product.countDocuments(),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

  const ordersByStatus = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));

  sendResponse(res, 200, 'Stats retrieved successfully', {
    revenue: revenue[0]?.total || 0,
    paidOrders: revenue[0]?.orders || 0,
    totalOrders: byStatus.reduce((sum, row) => sum + row.count, 0),
    ordersByStatus,
    topProducts,
    lowStock,
    totalProducts,
    totalUsers,
    newUsersLast30Days: newUsers,
  });
});
