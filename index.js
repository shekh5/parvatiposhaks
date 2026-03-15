import app from "./app.js";
import dotenv from 'dotenv';
import dbConnect from "./db/dbConnect.js";

dotenv.config();

const PORT = process.env.PORT || 3000;


//handle uncaught exceptions
process.on('uncaughtException',(error)=>{
    console.log(`Uncaught Exception: ${error.message}`);
    console.log("Shutting down the server due to uncaught exception");
    process.exit(1);
})


// dbConnect().then(app.listen(PORT,()=>{
//     console.log(`Server is running on port ${PORT}`)
// })).catch((error)=>{
//     console.log("Failed to connect to database. Server not started.",error);
//     process.exit(1);
// })

dbConnect();

const server = app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`)
})

process.on('unhandledRejection',(error)=>{
    console.log(`Unhandled Rejection: ${error.message}`);
    console.log("Shutting down the server due to unhandled promise rejection");
    server.close(()=>{
        process.exit(1);
    })
})


// console.log(myname)

/*
UncaughtException: Occurs when a synchronous error escapes all try/catch blocks, leading to a crash. 
1
UnhandledRejection: Occurs when a promise is rejected and there is no .catch() handler, leading to a crash by default in Node.js v15 and later. 
1
Difference: UncaughtException is a synchronous error, while UnhandledRejection is an asynchronous error. 
1
Handling: Both require proper error-handling code to prevent crashes and data integrity issues. 
2


4 Sources
*/