import { Router } from "express";
import { getAllProducts, getSingleProduct,createProduct,updateProduct ,deleteProduct} from "../controllers/product.controller.js";
import { createProductValidator } from "../validators/index.js";
import validateRequest from "../middleware/validator.middleware.js";


const router = Router();

router.post("/create-product",createProductValidator(),validateRequest,createProduct)

router.get("/products",getAllProducts)

router.route("/product/:id").get(getSingleProduct).put(updateProduct).delete(deleteProduct)

export default router;