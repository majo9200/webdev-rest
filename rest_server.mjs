import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

const port = 8000;

let app = express();
app.use(express.json());

/********************************************************************
 ***   DATABASE FUNCTIONS                                         *** 
 ********************************************************************/
// Open SQLite3 database (in read-write mode)
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + path.basename(db_filename));
    }
    else {
        console.log('Now connected to ' + path.basename(db_filename));
    }
});

// Create Promise for SQLite3 database SELECT query 
function dbSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

// Create Promise for SQLite3 database INSERT or DELETE query
function dbRun(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(this.changes);
            }
        });
    });
}

/********************************************************************
 ***   REST REQUEST HANDLERS                                      *** 
 ********************************************************************/
// GET request handler for crime codes
app.get('/codes', (req, res) => {

    let sql = 'SELECT * FROM Codes';
    if(req.query.code) {
        sql += ` WHERE code IN (${req.query.code})`; //create sql query with ids
    }
    dbSelect(sql)
        .then( data => res.status(200).type('json').send(data))
        .catch( err => res.status(500).type('text').send(err));
});

// GET request handler for neighborhoods
app.get('/neighborhoods', (req, res) => {
    let sql = 'SELECT * FROM Neighborhoods';
    if(req.query.id) {
        sql += ` WHERE neighborhood_number IN (${req.query.id})`; //create sql query with ids
    }
    dbSelect(sql)
        .then( data => res.status(200).type('json').send(data))
        .catch( err => res.status(500).type('text').send(err));
});

// GET request handler for crime incidents
app.get('/incidents', (req, res) => {
    let limit = req.query.limit ? req.query.limit : 1000; //Default limit is 1000

    let constraints = ['1']; //first constraint always evaluates to true. Guarantees that constraints is never empty array

    //add each parameter to constraints array
    if(req.query.start_date) {
        constraints.push(`date >= '${req.query.start_date}'`);
    }
    if(req.query.end_date) {
        constraints.push(`date <= '${req.query.end_date}'`);
    }
    if(req.query.code) {
        constraints.push(`code IN (${req.query.code})`);
    }
    if(req.query.grid) {
        constraints.push(`police_grid IN (${req.query.grid})`);
    }
    if(req.query.neighborhood) {
        constraints.push(`neighborhood_number IN (${req.query.neighborhood})`);
    }

    let query = `
        SELECT
            case_number,
            SUBSTR(date_time, 1, 10) AS date,
            SUBSTR(date_time, 12, 8) AS time,
            code,
            incident,
            police_grid,
            neighborhood_number,
            block
        FROM incidents
        WHERE ${constraints.join(" AND ")} 
        ORDER BY date_time DESC
        LIMIT ?
    `;
    dbSelect(query, limit)
        .then( data => res.status(200).type('json').send(data))
        .catch( err => res.status(500).type('text').send(err));
});



// PUT request handler for new crime incident
app.put('/new-incident', (req, res) => {
    //create sql query with named parameters
    let sql = 'INSERT INTO Incidents VALUES ($case_number, $date_time,$code,$incident,$police_grid,$neighborhood_number,$block)';

    //create new object with date_time instead of date and time keys
    let {date, time , ...params} = req.body;
    params.date_time = `${req.body.date}T${req.body.time}`;
    //change key names to match sqlite parameter binding
    Object.keys(params).forEach( key => {
        params['$' + key] = params[key];
        delete params[key]
    })
    dbRun(sql, params)
        .then( () => res.status(200).type('text').send(`added case ${req.body.case_number}`))
        .catch( err => res.status(500).type('text').send(err));
    /*
    let data = req.body;

    let sqlCheck = `SELECT EXISTS(SELECT 1 FROM Incidents WHERE case_number = ?) AS found`;

    dbSelect(sqlCheck, [data.case_number])
        .then(rows => {
            if (rows[0].found === 1) {
                return res.status(500).type("txt").send("Case number already exists");
            }

            let sqlInsert = `
                INSERT INTO Incidents 
                (case_number, date_time, code, incident, police_grid, neighborhood_number, block) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            let date_time = `${data.date}T${data.time}`;


            let params = [
                data.case_number,
                date_time,
                data.code,
                data.incident,
                data.police_grid,
                data.neighborhood_number,
                data.block
            ];

            return dbRun(sqlInsert, params)
                .then(() => res.status(200).type("txt").send("OK"))
                .catch(err => {
                    console.log(err);
                    res.status(500).type("txt").send("Error inserting new incident");
                });
        })
        .catch(err => {
            console.log(err);
            res.status(500).type("txt").send("Database error");
        });*/
});


// DELETE request handler for new crime incident
app.delete('/remove-incident', (req, res) => {
    let case_number = req.body.case_number;
    let sql = `DELETE FROM Incidents WHERE case_number = ${case_number}`;
    dbRun(sql)
        .then( changes => {
            if(changes) {
                res.status(200).type('text').send(`removed case ${case_number}`);
            } else {
                return Promise.reject("Case number does not exist in database");
            }
        })
        .catch( err => res.status(500).type('text').send(err));
    /*
    let sqlCheck = `SELECT EXISTS(SELECT 1 FROM Incidents WHERE case_number=${case_number})`
    dbSelect(sqlCheck) //this will return an object that will hold either 1 or 0, depending on if the case number is present in the database
    .then(data =>{
        let check = Object.values(data[0])[0]; //grabs the value (0,1) from the only javascript object present
        if(check){
            let sql = `DELETE FROM Incidents WHERE case_number = ${case_number}`
            dbRun(sql)
            .then(res.status(200).type('txt').send(`removed case ${case_number} from databse`))
            .catch((err) => {
            console.log(err);
        })
        }else{
            res.status(500).type('txt').send('Case number does not exist in database');
        }
    })
    .catch((err) => {
        console.log(err);
    })

     */
});

/********************************************************************
 ***   START SERVER                                               *** 
 ********************************************************************/
// Start server - listen for client connections
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
