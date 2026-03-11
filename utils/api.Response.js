class apiResponse {
    constructor(statusCode,message,data,success=true,token){
        this.statusCode = statusCode;
        this.message = message || "success";
        this.data = data;
        this.success = success;
        this.token = token;
    }
}

export default apiResponse;