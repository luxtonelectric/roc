import PhoneManager from "../src/phonemanager";
import Simulation from "../src/model/simulation";
import Train from "../src/model/train";
import Location from "../src/model/location";
import PhonebookEntry from "../src/model/phonebookentry";
import Phone from "../src/model/phone";
import Player from "../src/model/player";


const simId1 = 'kingscross';
const panelId1 = "hitchin";
const panelId2 = "palace";

const simData = {
  "name":"Kings Cross",
  "panels":[
    {"id":"cross", "name":"Cross", "neighbours":[{"simId":"kingscross", "panelId":"finsbury"},{"simId":"kingscross", "panelId":"palace"}]},
    {"id":"finsbury", "name":"Finsbury", "neighbours":[{"simId":"kingscross", "panelId":"cross"},{"simId":"kingscross", "panelId":"palace"}]},
    {"id": panelId2, "name":"Palace", "neighbours":[{"simId":"kingscross", "panelId":"finsbury"},{"simId":"kingscross", "panelId":"cross"},{"simId":"kingscross", "panelId":"welwyn"}]},
    {"id":"welwyn", "name":"Welwyn", "neighbours":[{"simId":"kingscross", "panelId":"palace"},{"simId":"kingscross", "panelId":panelId1}]},
    {"id": panelId1, "name":"Hitchin", "neighbours":[{"simId":"kingscross", "panelId":"welwyn"},{"simId":"peterborough", "panelId":"hitchintempsford"},{"simId":"royston", "panelId":"royston"}]}
  ]
}

test('Generating panel phones plus Control', () => {
  const phoneManager = new PhoneManager();
  const sim = new Simulation(simId1, simData);
  phoneManager.generatePhonesForSim(sim)
  expect(phoneManager.phones.length).toBe(8);
})

test('Generate phone for train', () => {
  const sameSimId = 'simId';
  const trainId = '999'
  const location = new Location(sameSimId,'panelId');
  const phoneManager = new PhoneManager();
  const train = new Train(sameSimId,trainId,'1S59')
  const phone = phoneManager.generatePhoneForTrain(train)
  expect(phone.isType(Phone.TYPES.TRAIN)).toBe(true);
  expect(phone.getId()).toBe(sameSimId + trainId);
  expect(phone.getLocation()).toBe(null);
  train.setLocation(location)
  expect(phone.getLocation()).toBe(location);
})

test('Generate phone for person', () => {
  const phoneManager = new PhoneManager();
  expect(() => phoneManager.generatePhoneForPerson()).toThrow('Invalid number or number already exists');
  expect(() => phoneManager.generatePhoneForPerson(null,'NAME')).toThrow('Invalid number or number already exists');
  
  const id1 = '99999'
  const name1= 'NAME';
  const phone = phoneManager.generatePhoneForPerson(id1,name1);
  expect(phone.getName()).toBe(name1);
  const pbe = new PhonebookEntry(id1,name1,Phone.TYPES.MOBILE)
  expect(phone.toSimple()).toStrictEqual(pbe);

  expect(() => phoneManager.generatePhoneForPerson(id1,name1)).toThrow('Invalid number or number already exists');
})

test('Get speed dial for phone', () => {
  const phoneManager = new PhoneManager();
  const sim = new Simulation(simId1, simData);
  phoneManager.generatePhonesForSim(sim)
  const phone = phoneManager.getPhone(simId1 + '_' + panelId1)
  expect(phone.getId()).toBe(simId1 + '_' + panelId1);
  const speedDial = phoneManager.getSpeedDialForPhone(phone);

  expect(speedDial).toHaveLength(4);

})

test('Get phones for a given DiscordId', () => {
  const discordID = 'DISCORDID';
  const phoneManager = new PhoneManager();
  const sim = new Simulation(simId1, simData);
  phoneManager.generatePhonesForSim(sim);
  const phone = phoneManager.getPhone(simId1 + '_' + panelId1);
  const player = new Player(null,discordID,'VC')
  phoneManager.assignPhone(phone,player)
  expect(phone.getDiscordId()).toBe(discordID);
  expect(phoneManager.getPhonesForDiscordId(discordID).length).toBe(1);

  const phone2 = phoneManager.getPhone(simId1 + '_' + panelId2);
  phoneManager.assignPhone(phone2,player)
  expect(phoneManager.getPhonesForDiscordId(discordID).length).toBe(2);
})