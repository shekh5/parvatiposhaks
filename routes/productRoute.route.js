import { Router } from "express";
import { getAllProducts, getSingleProduct,createProduct,updateProduct ,deleteProduct,getAdminProducts,createProductReview,getProductReviews,deleteReview} from "../controllers/product.controller.js";
import { createProductValidator } from "../validators/index.js";
import validateRequest from "../middleware/validator.middleware.js";
import { verifyUserAuth ,roleBasedAccess} from "../middleware/userAuth.middleware.js";



const router = Router();
router.get("/admin/products",verifyUserAuth,roleBasedAccess("admin"),getAdminProducts)

router.post("/admin/product/create",verifyUserAuth,roleBasedAccess("admin"),createProductValidator(),validateRequest,createProduct)

router.get("/products",getAllProducts)

router.route("/product/:id").get(verifyUserAuth,getSingleProduct)
router.route("/admin/product/:id").put(verifyUserAuth,roleBasedAccess("admin"),updateProduct).delete(verifyUserAuth,roleBasedAccess("admin"),deleteProduct)

router.put("/review",verifyUserAuth,createProductReview)
router.get("/review",getProductReviews)
router.delete("/review",verifyUserAuth,deleteReview)
export default router;