import iLocatable from "../../src/model/iLocatable"
import Location from "../../src/model/location"


test('Do Sim locations match?', () => {
  const location11 = new Location('SIM1','PANEL1');
  const loc = new iLocatable(location11)
  expect(loc.getLocation()).toBe(location11);
})

test('Same sim work?', () => {
  const iLoc11 = new iLocatable(new Location('SIM1','PANEL1'))
  const iLoc12 = new iLocatable(new Location('SIM1','PANEL2'))
  const iLoc22 = new iLocatable(new Location('SIM2','PANEL2'))
  expect(iLoc11.isInSameSim(iLoc11)).toBe(true);
  expect(iLoc11.isInSameSim(iLoc12)).toBe(true);
  expect(iLoc11.isInSameSim(iLoc22)).toBe(false);
  expect(iLoc11.isInSameSim(null)).toBe(false);
})

test('Same sim work?', () => {
  const iLoc11 = new iLocatable(new Location('SIM1','PANEL1'))
  const iLoc11clone = new iLocatable(new Location('SIM1','PANEL1'))
  const iLoc12 = new iLocatable(new Location('SIM1','PANEL2'))
  const iLoc21 = new iLocatable(new Location('SIM2','PANEL1'))
  expect(iLoc11.isInSamePanel(iLoc11)).toBe(true);
  expect(iLoc11.isInSamePanel(iLoc11clone)).toBe(true);
  expect(iLoc11.isInSamePanel(iLoc12)).toBe(false);
  expect(iLoc11.isInSamePanel(iLoc21)).toBe(false);
  expect(iLoc11.isInSamePanel(null)).toBe(false);
})