// @ts-check
import Panel from '../../src/model/panel.js';

describe('Panel Model', () => {
  test('fromSimData creates proper Panel instance', () => {
    const panelData = {
      id: 'test-panel',
      name: 'Test Panel',
      neighbours: [
        { simId: 'sim1', panelId: 'panel1' },
        { simId: 'sim2', panelId: 'panel2' }
      ]
    };

    const panel = Panel.fromSimData(panelData);

    // Verify it returns a proper Panel instance
    expect(panel).toBeInstanceOf(Panel);
    expect(panel.constructor.name).toBe('Panel');
    
    // Verify properties are correctly set
    expect(panel.id).toBe('test-panel');
    expect(panel.name).toBe('Test Panel');
    expect(panel.neighbours).toEqual([
      { simId: 'sim1', panelId: 'panel1' },
      { simId: 'sim2', panelId: 'panel2' }
    ]);
    
    // Verify Panel-specific properties exist
    expect('phone' in panel).toBe(true);
    expect(panel.phone).toBeUndefined();
    expect('player' in panel).toBe(true);
    expect(panel.player).toBeUndefined();
  });

  test('fromSimData with empty neighbours', () => {
    const panelData = {
      id: 'simple-panel',
      name: 'Simple Panel',
      neighbours: []
    };

    const panel = Panel.fromSimData(panelData);

    expect(panel).toBeInstanceOf(Panel);
    expect(panel.id).toBe('simple-panel');
    expect(panel.name).toBe('Simple Panel');
    expect(panel.neighbours).toEqual([]);
  });

  test('Panel instance has expected properties', () => {
    const panel = new Panel();
    
    // Test that a new Panel has the expected properties
    expect('id' in panel).toBe(true);
    expect('name' in panel).toBe(true);
    expect('player' in panel).toBe(true);
    expect('neighbours' in panel).toBe(true);
    expect('phone' in panel).toBe(true);
    
    // Test initial values
    expect(panel.id).toBeUndefined();
    expect(panel.name).toBeUndefined();
    expect(panel.player).toBeUndefined();
    expect(panel.neighbours).toEqual([]);
    expect(panel.phone).toBeUndefined();
  });

  test('Panel phone property can be assigned', () => {
    const panel = new Panel();
    
    // Initially undefined
    expect(panel.phone).toBeUndefined();
    
    // Can be assigned (using any to bypass TypeScript checking in tests)
    panel.phone = /** @type {any} */ ({ getId: () => 'test-phone' });
    
    expect(panel.phone).toBeDefined();
    expect(typeof panel.phone).toBe('object');
  });
});
