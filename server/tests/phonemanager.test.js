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
  "id": "kingscross",
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
  const sim = Simulation.fromSimData(simId1, simData);
  phoneManager.generatePhonesForSim(sim)
  // 5 panel phones (cross, finsbury, palace, welwyn, hitchin) + 1 control phone
  expect(phoneManager.phones.length).toBe(6);
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
  const sim = Simulation.fromSimData(simId1, simData);
  phoneManager.generatePhonesForSim(sim)
  const phone = phoneManager.getPhone(simId1 + '_' + panelId1)
  expect(phone.getId()).toBe(simId1 + '_' + panelId1);
  const speedDial = phoneManager.getSpeedDialForPhone(phone);

  // Only 2 phones should be in speed dial without neighboring sim data:
  // 1. Welwyn (neighbor in same sim)
  // 2. Control phone
  expect(speedDial).toHaveLength(2);

})

test('Get phones for a given DiscordId', () => {
  const discordID = 'DISCORDID';
  const phoneManager = new PhoneManager();
  const sim = Simulation.fromSimData(simId1, simData);
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

const peterboroughData = {
  "id": "peterborough",
  "name": "Peterborough",
  "panels": [
    {"id": "hitchintempsford", "name": "Hitchin-Tempsford", "neighbours": [
      {"simId": "kingscross", "panelId": "hitchin"},
      {"simId": "cambridge", "panelId": "sandy"}
    ]},
    {"id": "peterborough", "name": "Peterborough", "neighbours": [
      {"simId": "peterborough", "panelId": "hitchintempsford"}
    ]}
  ]
}

const cambridgeData = {
  "id": "cambridge",
  "name": "Cambridge",
  "panels": [
    {"id": "sandy", "name": "Sandy", "neighbours": [
      {"simId": "peterborough", "panelId": "hitchintempsford"},
      {"simId": "cambridge", "panelId": "cambridge"}
    ]},
    {"id": "cambridge", "name": "Cambridge", "neighbours": [
      {"simId": "cambridge", "panelId": "sandy"}
    ]}
  ]
}

test('Remove unused neighbor phones when deactivating sim', () => {
  const phoneManager = new PhoneManager();
  
  // Create mock ROCManager that only provides getSimData
  const mockROCManager = {
    getSimData: (simId) => {
      const simulations = {
        'kingscross': Simulation.fromSimData('kingscross', simData),
        'peterborough': Simulation.fromSimData('peterborough', peterboroughData),
        'cambridge': Simulation.fromSimData('cambridge', cambridgeData)
      };
      return simulations[simId];
    }
  };

  // Initial state: Kings Cross and Peterborough are active
  const kingsCross = mockROCManager.getSimData('kingscross');
  const peterborough = mockROCManager.getSimData('peterborough');
  
  // Set up initial active state
  phoneManager.generatePhonesForSim(kingsCross);  // Creates phones for Kings Cross panels
  phoneManager.generatePhonesForSim(peterborough);  // Creates phones for Peterborough panels
  phoneManager.generateMissingNeighbourPhones(mockROCManager);  // This will create the Sandy phone
  
  // When Kings Cross and Peterborough are active, phones should exist for:
  // 1. All Kings Cross panels (5) + control phone (1)
  // 2. All Peterborough panels (2) + control phone (1)
  // 3. Neighbor panels from Cambridge that are neighbors of active sims (1 - Sandy)
  // Total: 10 phones
  const initialPhones = phoneManager.phones.map(p => p.getId());
  console.log('Initial phones:', initialPhones);
  expect(phoneManager.phones.length).toBe(10);
  
  // Specific checks for neighbor phones
  expect(phoneManager.getPhone('cambridge_sandy')).toBeTruthy();  // Should exist because it's a neighbor of Peterborough
  
  // Now simulate deactivating Peterborough
  const remainingActiveSims = [kingsCross];  // Only Kings Cross remains active
  console.log('Kings Cross panels:', kingsCross.panels.map(p => p.id));
  kingsCross.panels.forEach(panel => {
    console.log('Panel', panel.id, 'neighbors:', panel.neighbours.map(n => `${n.simId}_${n.panelId}`));
  });
  phoneManager.removeUnusedNeighbourPhones(mockROCManager, 'peterborough', remainingActiveSims);
  
  const remainingPhones = phoneManager.phones.map(p => p.getId());
  console.log('Remaining phones:', remainingPhones);
  
  // After deactivating Peterborough:
  // 1. Should remove all Peterborough phones except the one needed by Kings Cross (hitchintempsford)
  // 2. Kings Cross phones should all remain
  // 3. Cambridge's Sandy panel phone should be removed (it was only needed by Peterborough)
  expect(phoneManager.phones.length).toBe(7);  // Kings Cross (6) + hitchintempsford (1)
  expect(phoneManager.getPhone('cambridge_sandy')).toBeFalsy();  // Should be removed as it's no longer needed
  expect(phoneManager.getPhone('peterborough_hitchintempsford')).toBeTruthy();  // Should remain as Kings Cross needs it
  expect(phoneManager.getPhone('peterborough_peterborough')).toBeFalsy();  // Should be removed
  expect(phoneManager.getPhone('kingscross_hitchin')).toBeTruthy();  // Should remain
  expect(phoneManager.getPhone('kingscross_control')).toBeTruthy();  // Should remain
});

test('No duplicate phones when re-enabling a sim', () => {
  const phoneManager = new PhoneManager();
  
  // Create mock ROCManager that only provides getSimData
  const mockROCManager = {
    getSimData: (simId) => {
      const simulations = {
        'kingscross': Simulation.fromSimData('kingscross', simData),
        'peterborough': Simulation.fromSimData('peterborough', peterboroughData),
        'cambridge': Simulation.fromSimData('cambridge', cambridgeData)
      };
      return simulations[simId];
    }
  };

  // Step 1: Enable Peterborough
  const peterborough = mockROCManager.getSimData('peterborough');
  phoneManager.generatePhonesForSim(peterborough);
  phoneManager.generateMissingNeighbourPhones(mockROCManager);
  
  // Step 2: Enable Kings Cross
  const kingsCross = mockROCManager.getSimData('kingscross');
  phoneManager.generatePhonesForSim(kingsCross);
  phoneManager.generateMissingNeighbourPhones(mockROCManager);

  // Step 3: Disable Kings Cross
  phoneManager.removeSim('kingscross', mockROCManager);

  // Verify state after disabling Kings Cross:
  // 1. Hitchin phone should be preserved as it's a neighbor of Peterborough's hitchintempsford panel
  // 2. Other Kings Cross phones (cross, finsbury, palace, welwyn, control) should be removed as they have no active neighbors
  const hitchinPhonesAfterDisable = phoneManager.phones.filter(p => p.getId() === 'kingscross_hitchin').length;
  expect(hitchinPhonesAfterDisable).toBe(1); // Hitchin should remain as it's a neighbor of an active panel

  const otherKingsCrossPhonesAfterDisable = phoneManager.phones.filter(p => {
    const id = p.getId();
    return id.startsWith('kingscross_') && !id.endsWith('hitchin');
  }).length;
  expect(otherKingsCrossPhonesAfterDisable).toBe(0); // Other Kings Cross phones should be removed

  // Step 4: Re-enable Kings Cross
  phoneManager.generatePhonesForSim(kingsCross);
  phoneManager.generateMissingNeighbourPhones(mockROCManager);

  // Verify final state:
  // 1. Should not have duplicated the existing Hitchin phone
  // 2. All other Kings Cross phones should be recreated
  const hitchinPhones = phoneManager.phones.filter(p => p.getId() === 'kingscross_hitchin');
  expect(hitchinPhones.length).toBe(1); // Still only one Hitchin phone

  const kingsCrossPhonesAfterReenable = phoneManager.phones.filter(p => p.getId().startsWith('kingscross_')).length;
  expect(kingsCrossPhonesAfterReenable).toBe(6); // All Kings Cross phones should now exist

  // Make sure all phones have unique IDs
  const phoneIds = new Set(phoneManager.phones.map(p => p.getId()));
  expect(phoneIds.size).toBe(phoneManager.phones.length); // Each phone should have a unique ID
});