class apiError extends Error{
    constructor(message="something went wrong",statuscode,errors=[],stack=""){
        super(message);
        this.statuscode = statuscode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;
        this.stack = stack;
    }
}

export default apiError;