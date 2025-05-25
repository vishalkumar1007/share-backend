// getUserIpAddressData

import express from "express";
import { getUserIpAddressData } from "../controllers/getUserIpAddressData.js";

const ipRoutes = express.Router();

ipRoutes.get('/',getUserIpAddressData);

export default ipRoutes;