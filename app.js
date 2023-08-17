const express = require("express");
const app = express();
app.use(express.json());

const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

const authenticationToken = (request, response, next) => {
  let jwtToken = null;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "mySecretCode", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertDBObjToResponseOb = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};
const convertDBObjToResponseOb2 = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};

initializeDBAndServer();
//API 0 login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserFromDb = `
  SELECT * 
  FROM 
  user
  WHERE
  username='${username}';`;
  const dbUser = await db.get(selectUserFromDb);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "mySecretCode");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 1 Returns a list of all states in the state table
app.get("/states/", authenticationToken, async (request, response) => {
  const getStates = `SELECT * FROM state;`;
  const statesList = await db.all(getStates);
  response.send(
    statesList.map((eachState) => {
      return convertDBObjToResponseOb(eachState);
    })
  );
});
//API 2:Returns a state based on the state ID
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStates = `SELECT * FROM state WHERE state_id=${stateId};`;
  const state = await db.get(getStates);
  response.send(convertDBObjToResponseOb(state));
});
//API 3 Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticationToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES
    (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 4:Returns a district based on the district ID

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDBObjToResponseOb2(district));
  }
);
//API 5:Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 6:Updates the details of a specific district based on the district ID
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDistrictDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDistrictDetails;
    const updateDistrictQuery = `UPDATE district
    SET 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE
    district_id= ${districtId};`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
//API 7:Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsOfStateQuery = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(Active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id= ${stateId};`;
    const statsOfState = await db.get(statsOfStateQuery);
    response.send(statsOfState);
  }
);

module.exports = app;
