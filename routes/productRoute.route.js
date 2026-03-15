import { Router } from "express";
import { getAllProducts, getSingleProduct,createProduct,updateProduct ,deleteProduct} from "../controllers/product.controller.js";
import { createProductValidator } from "../validators/index.js";
import validateRequest from "../middleware/validator.middleware.js";
import { verifyUserAuth ,roleBasedAccess} from "../middleware/userAuth.middleware.js";


const router = Router();

router.post("/create-product",verifyUserAuth,roleBasedAccess("admin"),createProductValidator(),validateRequest,createProduct)

router.get("/products",verifyUserAuth,getAllProducts)

router.route("/product/:id").get(verifyUserAuth,getSingleProduct).put(verifyUserAuth,roleBasedAccess("admin"),updateProduct).delete(verifyUserAuth,roleBasedAccess("admin"),deleteProduct)

export default router;