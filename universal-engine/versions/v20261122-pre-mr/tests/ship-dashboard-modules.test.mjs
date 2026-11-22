import test from "node:test";
import assert from "node:assert/strict";
import {installCockpitDashboard} from "../planet-explorer/ship-cockpit-dashboard-ui.mjs";
import {installSpaceCombatUI} from "../planet-explorer/space-combat-ui.mjs";
import {installSpaceFlightUI} from "../planet-explorer/space-flight-ui.mjs";

test("cockpit dashboard, combat controls and dual-stick UI import without DOM globals",()=>{
 assert.equal(typeof installCockpitDashboard,"function");
 assert.equal(typeof installSpaceCombatUI,"function");
 assert.equal(typeof installSpaceFlightUI,"function");
});
