import {body} from "express-validator"

const createProductValidator = () => {
    return [
        body("name").notEmpty().withMessage("Name is required"),
        body("description").notEmpty().withMessage("Description is required"),
        body("price").notEmpty().withMessage("Price is required").isNumeric().withMessage("Price must be a number"),
        body("category").notEmpty().withMessage("Category is required"),
        body("Stock").notEmpty().withMessage("Stock is required").isNumeric().withMessage("Stock must be a number"),
    
    ]
}

const userValidator = ()=>{
    return [
        body("name").notEmpty().withMessage("Name is required"),
        body("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Please enter a valid email address"),
        body("password").notEmpty().withMessage("Password is required").isLength({min:8}).withMessage("Password must be at least 8 characters long"),
        body("username").trim().isLength({min:3}).withMessage("username should of length 3").isLength({max:13}).withMessage("username should not exceed 13"),
    ]
}

const loginValidator = ()=>{
    return [
        body("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Please enter a valid email address"),
        body("password").notEmpty().withMessage("Password is required").isLength({min:8}).withMessage("Password must be at least 8 characters long")
    ]
}

export {createProductValidator, userValidator,loginValidator}