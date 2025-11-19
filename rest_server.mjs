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
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/********************************************************************
 ***   REST REQUEST HANDLERS                                      *** 
 ********************************************************************/
// GET request handler for crime codes
app.get('/codes', (req, res) => {
    if(req.query.hasOwnProperty('code')){
        let code_list = req.query.code.split(',').parseInt;
        let sql = 'SELECT * FROM Codes WHERE code IN (' + req.query.code + ')';
        dbSelect(sql,code_list)
        .then(data => res.status(200).type('json').send(data))
        .catch((err) => {
            console.log(err);
        })
    }else{
        let sql = 'SELECT * FROM Codes';
        dbSelect(sql)
        .then(data => res.status(200).type('json').send(data))
        .catch((err) => {
            console.log(err);
        })
    }
});

// GET request handler for neighborhoods
app.get('/neighborhoods', (req, res) => {
    let sql = 'SELECT * FROM Neighborhoods';
    if(req.query.id) {
        sql += `WHERE neighborhood_number IN (${req.query.id})`; //create sql query with ids
    }
    dbSelect(sql)
        .then( data => res.status(200).type('json').send(data))
        .catch( err => res.status(500).type('text').send(err));
});

// GET request handler for crime incidents
app.get('/incidents', (req, res) => {
    let limit = req.query.limit ? req.query.limit : 1000; //Default limit is 1000

    let constraints = [1];

    if(req.query.start_date) {
        constraints.push(`date_time >= (${req.query.start_date})`);
    }
    if(req.query.end_date) {
        constraints.push(`date_time <= (${req.query.end_date})`);
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
    console.log(query);
    dbSelect(query, limit)
        .then( data => res.status(200).type('json').send(data))
        .catch( err => res.status(500).type('text').send(err));
});



// PUT request handler for new crime incident
app.put('/new-incident', (req, res) => {
    console.log(req.body); // uploaded data

    
    res.status(200).type('txt').send('OK'); // <-- you may need to change this
});

// DELETE request handler for new crime incident
app.delete('/remove-incident', (req, res) => {
    console.log(req.body); // uploaded data
    
    res.status(200).type('txt').send('OK'); // <-- you may need to change this
});

/********************************************************************
 ***   START SERVER                                               *** 
 ********************************************************************/
// Start server - listen for client connections
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
