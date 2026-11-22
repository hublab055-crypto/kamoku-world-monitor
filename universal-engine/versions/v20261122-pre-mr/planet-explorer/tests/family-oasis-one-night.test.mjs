import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FamilyLife,FAMILY_PRIVATE_MOD_EVENT,FAMILY_PRIVATE_MOD_API_VERSION,
 FAMILY_ONENIGHT_MIN_AFFINITY} from "../family-life.mjs";
import {ShipCrewSocial} from "../ship-crew-social.mjs";

function setup(){
 const family=new FamilyLife(null,{day:100});
 const social=new ShipCrewSocial();
 social.members.navigator.points=FAMILY_ONENIGHT_MIN_AFFINITY;
 return {family,social};
}
test("OASIS single-player one-night requires both player opt-in and NPC acceptance",()=>{
 const {family,social}=setup();
 const blank=social.status("navigator");
 assert.equal(blank.casualConsent,false);
 assert.equal(family.action("navigator","private",{oneNight:true,mutualConsent:true,relationship:blank}).ok,false);
 assert.equal(social.deepen("navigator","casual").ok,true);
 const agreed=social.status("navigator");
 assert.equal(agreed.casualConsent,true);
 assert.equal(family.action("navigator","private",{oneNight:true,mutualConsent:true,relationship:agreed}).ok,false,"9876 required");
 assert.equal(family.unlock("9876",{adultConfirmation:true}).ok,true);
 assert.equal(family.action("navigator","private",{oneNight:true,mutualConsent:false,relationship:agreed}).ok,false);
 assert.equal(family.action("navigator","private",{oneNight:false,mutualConsent:true,relationship:agreed}).ok,false);
 assert.equal(family.action("navigator","private",{oneNight:true,mutualConsent:true,relationship:agreed,sceneMode:"invalid"}).ok,false);
 const result=family.action("navigator","private",{oneNight:true,mutualConsent:true,
  relationship:agreed,sceneMode:"mod"});
 assert.equal(result.ok,true);
 assert.equal(result.event.relationshipType,"one-night");
 assert.equal(result.event.fadeToBlack,false);
 assert.equal(result.event.cameraTransition,"retain");
 assert.equal(result.event.modEvent.name,FAMILY_PRIVATE_MOD_EVENT);
 assert.equal(result.event.modEvent.version,FAMILY_PRIVATE_MOD_API_VERSION);
 assert.equal(result.event.modEvent.renderContent,"external-only");
 assert.equal(family.partners.navigator,undefined,"casual relationship must not become permanent");
 assert.equal(family.encounters.navigator.privateTime,1);
 assert.equal(family.snapshot().history.some(e=>e.type==="private"),false,"never persist private MOD event details");
 assert.equal(social.consumeCasualConsent("navigator"),true);
 assert.equal(social.status("navigator").casualConsent,false);
 assert.equal(family.action("navigator","private",{oneNight:true,mutualConsent:true,
  relationship:social.status("navigator"),sceneMode:"mod"}).ok,false);
});
test("an NPC can refuse; acceptance expires and is not saved",()=>{
 const {social}=setup();
 social.members.engineer.points=74;
 assert.equal(social.deepen("engineer","casual").ok,false);
 assert.equal(social.status("engineer").casualConsent,false);
 social.deepen("navigator","casual");
 const snapshot=social.snapshot();
 const restored=new ShipCrewSocial(snapshot);
 assert.equal(restored.status("navigator").casualConsent,false,"save reload revokes consent");
 social.clock+=181;social.advance(0);
 assert.equal(social.status("navigator").casualConsent,false,"consent must expire");
});
test("after consensual nonmarital encounter, pregnancy still needs separate consent",()=>{
 const {family,social}=setup();family.unlock("9876",{adultConfirmation:true});
 social.deepen("navigator","casual");
 const agreed=social.status("navigator");
 const r=family.action("navigator","private",{oneNight:true,mutualConsent:true,relationship:agreed});
 assert.equal(r.ok,true);assert.equal(r.event.fadeToBlack,true,"base game stays non-graphic");
 assert.equal(family.planPregnancy("navigator",{mutualConsent:false}).ok,false);
 const p=family.planPregnancy("navigator",{mutualConsent:true,gestationalParent:"navigator"});
 assert.equal(p.ok,true);
 assert.equal(family.isProtectedChild(family.pregnancies[0].id),true);
 assert.equal(family.canCombatTarget(family.pregnancies[0].id),false);
 family.advanceTo(family.day+280);
 assert.equal(family.children.length,1);
 assert.equal(family.canCombatTarget(family.children[0].id),false);
});
test("no minor, non-adult, or wrong-code path can trigger MOD signal",()=>{
 const {family,social}=setup();social.deepen("navigator","casual");
 const opts={mutualConsent:true,oneNight:true,sceneMode:"mod",relationship:social.status("navigator")};
 assert.equal(family.unlock("9876",{adultConfirmation:false}).ok,false);
 assert.equal(family.action("navigator","private",opts).ok,false);
 family.unlock("9876",{adultConfirmation:true});
 assert.equal(family.action("child-1","private",opts).ok,false);
 family.adults.navigator.ageYears=17;
 assert.equal(family.action("navigator","private",opts).ok,false);
 assert.equal(family.encounters.navigator,undefined);
 family.adults.navigator.ageYears=25;
 const save=family.snapshot(),again=new FamilyLife(save);
 assert.equal(again.privateUnlocked,false);
 assert.equal(again.action("navigator","private",opts).ok,false);
});
test("browser wiring is event-only with no authored intimate animation",()=>{
 const ui=readFileSync(new URL("../family-life-ui.mjs",import.meta.url),"utf8");
 const source=readFileSync(new URL("../family-life.mjs",import.meta.url),"utf8");
 assert.match(ui,/data-one-night/);
 assert.match(ui,/data-mod/);
 assert.match(ui,/deepenRelationship\?\.\(partner\.value,"casual"\)/);
 assert.match(ui,/consumeCasualConsent/);
 assert.match(ui,/dispatchEvent\(new CustomEvent\(FAMILY_PRIVATE_MOD_EVENT/);
 assert.match(source,/renderContent:"external-only"/);
});
