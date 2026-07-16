import express from "express";
import userAuth from '../middleware/UserAuth.js';
import AdminAuth from '../middleware/AdminAuth.js';
import { 
    addDivision, 
    modifyDivision,
    deleteDivision, 
    getAllDivisions, 
    getRecentlyAddedDivisions, 
    getDivisionById,
    addCoachToDivision,
    removeCoachFromDivision,
    transferCoach
} from "../controller/DivisionController.js";

const divisionRouter = express.Router();

// Division routes
// Add, modify, delete divisions (admin only)
divisionRouter.post(
    '/add-division',
    userAuth,
    AdminAuth,
    addDivision
);

divisionRouter.put(
    '/modify-division/:id',
    userAuth,
    AdminAuth,
    modifyDivision
);

divisionRouter.delete(
    '/delete-division/:id',
    userAuth,
    AdminAuth,
    deleteDivision
);

divisionRouter.get('/get-all-division', getAllDivisions); // fetch all division 
divisionRouter.get('/recent-division', getRecentlyAddedDivisions); // recent division
divisionRouter.get('/division-id/:id', getDivisionById); // get division by id

// Coach management routes
divisionRouter.post(
    '/division/:id/add-coach',
    userAuth,
    AdminAuth,
    addCoachToDivision
);

divisionRouter.delete(
    '/division/:id/remove-coach/:uid',
    userAuth,
    AdminAuth,
    removeCoachFromDivision
);
divisionRouter.post("/transfer-coach", userAuth, transferCoach); // transfer coach from one division to another

export default divisionRouter;