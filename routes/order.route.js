import express from "express";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.middleware.js";
import { createOrder, getSingleOrder,myOrders,getAllOrders ,updateOrderStatus,deleteOrder} from "../controllers/order.controller.js";

const router = express.Router();
router.post("/order/create", verifyUserAuth , createOrder);
router.get("/admin/order/:id", verifyUserAuth,roleBasedAccess("admin"), getSingleOrder)
router.put("/admin/order/:id", verifyUserAuth,roleBasedAccess("admin"),updateOrderStatus)
router.delete("/admin/order/:id", verifyUserAuth,roleBasedAccess("admin"),deleteOrder)
router.get("/orders/user", verifyUserAuth, myOrders)
router.get("/admin/orders",verifyUserAuth,roleBasedAccess("admin"), getAllOrders)


export default router;