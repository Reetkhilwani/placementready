const mysql= require("mysql");
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "node1"
});

connection.connect(function(error){
    if(error) throw error
    else console.log("connected to database")

})
