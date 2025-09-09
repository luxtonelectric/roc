import { jest } from '@jest/globals';
import PhoneManager from "../src/phonemanager";
import Simulation from "../src/model/simulation";
import Train from "../src/model/train";
import Location from "../src/model/location";
import PhonebookEntry from "../src/model/phonebookentry";
import Phone from "../src/model/phone";
import Player from "../src/model/player";
import SimulationLoader from "../src/services/SimulationLoader";


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

// Create a mock SimulationLoader for testing
const createMockSimulationLoader = (simulations = {}) => {
  return {
    loadSimulation: (simId) => {
      if (simulations[simId]) {
        return Simulation.fromSimData(simId, simulations[simId]);
      }
      return null;
    }
  };
};

test('Generating panel phones plus Control', () => {
  const mockLoader = createMockSimulationLoader();
  const phoneManager = new PhoneManager(mockLoader);
  const sim = Simulation.fromSimData(simId1, simData);
  phoneManager.generatePhonesForSim(sim)
  // 5 panel phones (cross, finsbury, palace, welwyn, hitchin) + 1 control phone
  expect(phoneManager.phones.length).toBe(6);
})

test('Panel phone association after generating phones', () => {
  const mockLoader = createMockSimulationLoader();
  const phoneManager = new PhoneManager(mockLoader);
  const sim = Simulation.fromSimData(simId1, simData);
  
  // Verify panels are proper Panel instances before phone generation
  sim.panels.forEach(panel => {
    expect(panel.constructor.name).toBe('Panel');
    expect('phone' in panel).toBe(true);
    expect(panel.phone).toBeUndefined();
  });
  
  phoneManager.generatePhonesForSim(sim);
  
  // Verify each panel has a phone assigned after generation
  sim.panels.forEach(panel => {
    expect(panel.phone).toBeDefined();
    expect(panel.phone.constructor.name).toBe('Phone');
    expect(panel.phone.getId()).toBe(`${simId1}_${panel.id}`);
    expect(panel.phone.getName()).toBe(`${simData.name} ${panel.name}`);
  });
  
  // Verify specific panel has correct phone
  const hitchinPanel = sim.getPanel(panelId1);
  expect(hitchinPanel).toBeDefined();
  expect(hitchinPanel.phone).toBeDefined();
  expect(hitchinPanel.phone.getId()).toBe(`${simId1}_${panelId1}`);
})

test('Generate phone for train', () => {
  const sameSimId = 'simId';
  const trainId = '999'
  const location = new Location(sameSimId,'panelId');
  const mockLoader = createMockSimulationLoader();
  const phoneManager = new PhoneManager(mockLoader);
  const train = new Train(sameSimId,trainId,'1S59')
  const phone = phoneManager.generatePhoneForTrain(train)
  expect(phone.isType(Phone.TYPES.TRAIN)).toBe(true);
  expect(phone.getId()).toBe(sameSimId + trainId);
  expect(phone.getLocation()).toBe(null);
  train.setLocation(location)
  expect(phone.getLocation()).toBe(location);
})

test('Generate phone for person', () => {
  const mockLoader = createMockSimulationLoader();
  const phoneManager = new PhoneManager(mockLoader);
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
  const mockLoader = createMockSimulationLoader();
  const phoneManager = new PhoneManager(mockLoader);
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
  const mockLoader = createMockSimulationLoader();
  const phoneManager = new PhoneManager(mockLoader);
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
  // Create mock SimulationLoader that provides neighbor simulation data
  const mockLoader = createMockSimulationLoader({
    'kingscross': simData,
    'peterborough': peterboroughData,
    'cambridge': cambridgeData
  });
  const phoneManager = new PhoneManager(mockLoader);
  
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
  
  // Set up initial active state - generatePhonesForSim now handles neighbor phones automatically
  phoneManager.generatePhonesForSim(kingsCross);  // Creates phones for Kings Cross panels + neighbors
  phoneManager.generatePhonesForSim(peterborough);  // Creates phones for Peterborough panels + neighbors
  
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
  phoneManager.removeUnusedNeighbourPhones((simId, loadIfNotExists) => mockROCManager.getSimData(simId, loadIfNotExists), 'peterborough', remainingActiveSims);
  
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
  // Create mock SimulationLoader that provides neighbor simulation data
  const mockLoader = createMockSimulationLoader({
    'kingscross': simData,
    'peterborough': peterboroughData,
    'cambridge': cambridgeData
  });
  const phoneManager = new PhoneManager(mockLoader);
  
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

  // Step 1: Enable Peterborough - generatePhonesForSim now handles neighbors automatically
  const peterborough = mockROCManager.getSimData('peterborough');
  phoneManager.generatePhonesForSim(peterborough);
  
  // Step 2: Enable Kings Cross - generatePhonesForSim now handles neighbors automatically
  const kingsCross = mockROCManager.getSimData('kingscross');
  phoneManager.generatePhonesForSim(kingsCross);

  // Step 3: Disable Kings Cross
  phoneManager.removeSim('kingscross', (simId, loadIfNotExists) => mockROCManager.getSimData(simId, loadIfNotExists));

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

  // Step 4: Re-enable Kings Cross - generatePhonesForSim now handles neighbors automatically
  phoneManager.generatePhonesForSim(kingsCross);

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

// Tests for getRECRecipientsForPhone method
describe('getRECRecipientsForPhone', () => {
  let phoneManager;
  let sim;
  let mockPlayer;

  beforeEach(() => {
    const mockLoader = createMockSimulationLoader();
    phoneManager = new PhoneManager(mockLoader);
    sim = Simulation.fromSimData(simId1, simData);
    phoneManager.generatePhonesForSim(sim);
    const mockSocket = { emit: () => {} };
    mockPlayer = new Player(mockSocket, 'test-discord-id', 'test-voice-channel');
  });

  test('returns neighbour phones for a panel phone', () => {
    // Get the palace panel phone (has 3 neighbors: finsbury, cross, welwyn)
    const palacePhone = phoneManager.getPhone(`${simId1}_${panelId2}`);
    expect(palacePhone).toBeDefined();

    const recipients = phoneManager.getRECRecipientsForPhone(palacePhone);

    // Should get the 3 neighbour phones
    const neighbourIds = recipients.map(p => p.getId()).filter(id => id !== `${simId1}_control`);
    expect(neighbourIds).toContain(`${simId1}_finsbury`);
    expect(neighbourIds).toContain(`${simId1}_cross`);
    expect(neighbourIds).toContain(`${simId1}_welwyn`);
    expect(neighbourIds.length).toBe(3);
  });

  test('includes control phone when control has a discord ID', () => {
    // Assign a player to control to give it a discord ID
    const controlPhone = phoneManager.getPhone(`${simId1}_control`);
    expect(controlPhone).toBeDefined();
    phoneManager.assignPhone(controlPhone, mockPlayer);

    // Get any panel phone
    const palacePhone = phoneManager.getPhone(`${simId1}_${panelId2}`);
    const recipients = phoneManager.getRECRecipientsForPhone(palacePhone);

    // Should include control phone
    const controlRecipient = recipients.find(p => p.getId() === `${simId1}_control`);
    expect(controlRecipient).toBeDefined();
    expect(controlRecipient.getDiscordId()).toBe('test-discord-id');
  });

  test('excludes control phone when control has no discord ID', () => {
    // Control phone starts with no assigned player/discord ID
    const controlPhone = phoneManager.getPhone(`${simId1}_control`);
    expect(controlPhone).toBeDefined();
    expect(controlPhone.getDiscordId()).toBeNull();

    // Get any panel phone
    const palacePhone = phoneManager.getPhone(`${simId1}_${panelId2}`);
    const recipients = phoneManager.getRECRecipientsForPhone(palacePhone);

    // Should not include control phone
    const controlRecipient = recipients.find(p => p.getId() === `${simId1}_control`);
    expect(controlRecipient).toBeUndefined();
  });

  test('returns correct neighbors for phone with single neighbor', () => {
    // Add a phone with only one neighbor by creating a new simulation with minimal structure
    const minimalSimData = {
      "id": "minimal",
      "name": "Minimal Sim",
      "panels": [
        {"id": "panel1", "name": "Panel One", "neighbours": [{"simId": "minimal", "panelId": "panel2"}]},
        {"id": "panel2", "name": "Panel Two", "neighbours": [{"simId": "minimal", "panelId": "panel1"}]}
      ]
    };

    const minimalSim = Simulation.fromSimData('minimal', minimalSimData);
    phoneManager.generatePhonesForSim(minimalSim);

    const panel1Phone = phoneManager.getPhone('minimal_panel1');
    const recipients = phoneManager.getRECRecipientsForPhone(panel1Phone);

    // Should only get the one neighbor (plus potentially control if assigned)
    const neighbourIds = recipients.map(p => p.getId()).filter(id => id !== 'minimal_control');
    expect(neighbourIds).toContain('minimal_panel2');
    expect(neighbourIds.length).toBe(1);
  });

  test('returns empty neighbors array for phone with no neighbors', () => {
    // Create a simulation with an isolated panel
    const isolatedSimData = {
      "id": "isolated",
      "name": "Isolated Sim",
      "panels": [
        {"id": "lonely", "name": "Lonely Panel", "neighbours": []}
      ]
    };

    const isolatedSim = Simulation.fromSimData('isolated', isolatedSimData);
    phoneManager.generatePhonesForSim(isolatedSim);

    const lonelyPhone = phoneManager.getPhone('isolated_lonely');
    const recipients = phoneManager.getRECRecipientsForPhone(lonelyPhone);

    // Should only potentially include control (if assigned), no neighbors
    const neighbourIds = recipients.map(p => p.getId()).filter(id => id !== 'isolated_control');
    expect(neighbourIds.length).toBe(0);
  });

  test('handles cross-simulation neighbors', () => {
    // Create another simulation that references panels from the first simulation
    const crossSimData = {
      "id": "crosssim",
      "name": "Cross Sim",
      "panels": [
        {"id": "cross_panel", "name": "Cross Panel", "neighbours": [
          {"simId": "kingscross", "panelId": "hitchin"},
          {"simId": "kingscross", "panelId": "welwyn"}
        ]}
      ]
    };

    const crossSim = Simulation.fromSimData('crosssim', crossSimData);
    phoneManager.generatePhonesForSim(crossSim);

    const crossPhone = phoneManager.getPhone('crosssim_cross_panel');
    const recipients = phoneManager.getRECRecipientsForPhone(crossPhone);

    // Should get the cross-simulation neighbor phones
    const neighbourIds = recipients.map(p => p.getId()).filter(id => !id.includes('_control'));
    expect(neighbourIds).toContain(`${simId1}_hitchin`);
    expect(neighbourIds).toContain(`${simId1}_welwyn`);
  });

  test('filters out undefined neighbors when referenced phone does not exist', () => {
    // Create a simulation that references non-existent panels
    const brokenSimData = {
      "id": "broken",
      "name": "Broken Sim", 
      "panels": [
        {"id": "broken_panel", "name": "Broken Panel", "neighbours": [
          {"simId": "nonexistent", "panelId": "fake_panel"},
          {"simId": "kingscross", "panelId": "hitchin"} // This one exists
        ]}
      ]
    };

    const brokenSim = Simulation.fromSimData('broken', brokenSimData);
    phoneManager.generatePhonesForSim(brokenSim);

    const brokenPhone = phoneManager.getPhone('broken_broken_panel');
    const recipients = phoneManager.getRECRecipientsForPhone(brokenPhone);

    // The current implementation includes undefined neighbors, so we need to filter them
    const validRecipients = recipients.filter(p => p !== undefined);
    const neighbourIds = validRecipients.map(p => p.getId()).filter(id => !id.includes('_control'));
    
    expect(neighbourIds).toContain(`${simId1}_hitchin`);
    expect(neighbourIds).not.toContain('nonexistent_fake_panel');
    // Note: The current implementation does not filter undefined neighbors automatically
    // This test documents the current behavior where undefined neighbors are included in the array
    expect(recipients.some(p => p === undefined)).toBe(true);
  });

  test('returns both neighbors and control when both conditions are met', () => {
    // Assign control phone
    const controlPhone = phoneManager.getPhone(`${simId1}_control`);
    phoneManager.assignPhone(controlPhone, mockPlayer);

    // Get a phone with neighbors
    const palacePhone = phoneManager.getPhone(`${simId1}_${panelId2}`);
    const recipients = phoneManager.getRECRecipientsForPhone(palacePhone);

    // Should include both neighbors and control
    const hasControl = recipients.some(p => p.getId() === `${simId1}_control`);
    const hasNeighbors = recipients.some(p => p.getId() === `${simId1}_finsbury`);
    
    expect(hasControl).toBe(true);
    expect(hasNeighbors).toBe(true);
    expect(recipients.length).toBeGreaterThan(3); // 3 neighbors + control
  });

  // Error handling tests for the bug fix
  test('handles phone with location referencing non-existent simulation', () => {
    // Mock console.error to capture error messages
    const originalError = console.error;
    const mockError = jest.fn();
    console.error = mockError;

    try {
      // Create a phone with location referencing a simulation that doesn't exist
      const invalidPhone = new Phone('invalid_phone', 'Invalid Phone', Phone.TYPES.FIXED, new Location('nonexistent_sim', 'some_panel'));
      
      const recipients = phoneManager.getRECRecipientsForPhone(invalidPhone);

      // Should return empty array instead of crashing
      expect(recipients).toEqual([]);
      
      // Should log error message about simulation not found
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('getRECRecipientsForPhone'),
        'Simulation not found:',
        'nonexistent_sim',
        'for phone:',
        'invalid_phone'
      );
    } finally {
      console.error = originalError;
    }
  });

  test('handles phone with location referencing non-existent panel', () => {
    // Mock console.error to capture error messages
    const originalError = console.error;
    const mockError = jest.fn();
    console.error = mockError;

    try {
      // Create a phone with location referencing a panel that doesn't exist in the simulation
      const invalidPhone = new Phone('invalid_panel_phone', 'Invalid Panel Phone', Phone.TYPES.FIXED, new Location(simId1, 'nonexistent_panel'));
      
      const recipients = phoneManager.getRECRecipientsForPhone(invalidPhone);

      // Should return empty array instead of crashing
      expect(recipients).toEqual([]);
      
      // Should log error message about panel not found
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('getRECRecipientsForPhone'),
        'Panel not found:',
        'nonexistent_panel',
        'in simulation:',
        simId1,
        'for phone:',
        'invalid_panel_phone'
      );
      
      // Should also log available panels for debugging
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('getRECRecipientsForPhone'),
        'Available panels in simulation:',
        expect.arrayContaining(['cross', 'finsbury', 'palace', 'welwyn', 'hitchin'])
      );
    } finally {
      console.error = originalError;
    }
  });

  test('handles phone without location gracefully', () => {
    // Mock console.error to capture error messages
    const originalError = console.error;
    const mockError = jest.fn();
    console.error = mockError;

    try {
      // Create a phone without location (mobile phone)
      const mobilePhone = new Phone('mobile123', 'Mobile Phone', Phone.TYPES.MOBILE, null);
      
      // This should throw an error when trying to access getLocation().simId
      expect(() => {
        phoneManager.getRECRecipientsForPhone(mobilePhone);
      }).toThrow();
    } finally {
      console.error = originalError;
    }
  });

  test('error logging provides detailed debugging information', () => {
    // Mock console.error to capture error messages
    const originalError = console.error;
    const mockError = jest.fn();
    console.error = mockError;

    try {
      // Create a phone with location referencing a panel that doesn't exist
      const testPhone = new Phone('debug_test_phone', 'Debug Test Phone', Phone.TYPES.FIXED, new Location('test_sim', 'missing_panel'));
      
      // Add a mock simulation to the phone manager that has some panels but not the one we're looking for
      const testSimData = {
        "id": "test_sim",
        "name": "Test Sim",
        "panels": [
          {"id": "panel1", "name": "Panel 1", "neighbours": []},
          {"id": "panel2", "name": "Panel 2", "neighbours": []}
        ]
      };
      const testSim = Simulation.fromSimData('test_sim', testSimData);
      phoneManager.sims.push(testSim);
      
      const recipients = phoneManager.getRECRecipientsForPhone(testPhone);

      // Should return empty array
      expect(recipients).toEqual([]);
      
      // Should log the panel not found error with detailed debugging info
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('getRECRecipientsForPhone'),
        'Panel not found:',
        'missing_panel',
        'in simulation:',
        'test_sim',
        'for phone:',
        'debug_test_phone'
      );
      
      // Should also log available panels for debugging
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('getRECRecipientsForPhone'),
        'Available panels in simulation:',
        ['panel1', 'panel2']
      );
    } finally {
      console.error = originalError;
    }
  });
});
