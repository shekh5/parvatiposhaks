import { Router } from 'express';
import {
  addCartItem,
  emptyCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../controllers/cart.controller.js';
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from '../controllers/wishlist.controller.js';
import { verifyUserAuth } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  addCartItemValidator,
  mongoIdParam,
  updateCartItemValidator,
} from '../validators/index.js';

const router = Router();

router.route('/cart').get(verifyUserAuth, getCart).delete(verifyUserAuth, emptyCart);
router.post('/cart/items', verifyUserAuth, addCartItemValidator(), validate, addCartItem);
router
  .route('/cart/items/:itemId')
  .put(verifyUserAuth, updateCartItemValidator(), validate, updateCartItem)
  .delete(verifyUserAuth, mongoIdParam('itemId'), validate, removeCartItem);

router.get('/wishlist', verifyUserAuth, getWishlist);
router
  .route('/wishlist/:productId')
  .post(verifyUserAuth, mongoIdParam('productId'), validate, addToWishlist)
  .delete(verifyUserAuth, mongoIdParam('productId'), validate, removeFromWishlist);

export default router;
