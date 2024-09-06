import Player from '../../src/model/player';
import Phone from '../../src/model/phone';
import Location from '../../src/model/location';

test('getId', () => {
  const phone = new Phone('id','name',Phone.TYPES.FIXED);
  expect(phone.getId()).toBe('id');
})

test('getDiscordId', () => {
  const player = new Player(null,'discordID','');
  const phone = new Phone('id','name',Phone.TYPES.FIXED);
  phone.setPlayer(player);
  
  const phoneNoPlayer = new Phone('id','name',Phone.TYPES.FIXED);
  expect(phone.getDiscordId()).toBe('discordID');
  expect(phoneNoPlayer.getDiscordId()).toBe(null);
})

test('check isType',() => {
  const phone = new Phone('id','name',Phone.TYPES.FIXED);
  expect(phone.isType(Phone.TYPES.FIXED)).toBe(true)
  expect(phone.isType(Phone.TYPES.MOBILE)).toBe(false)
  expect(phone.isType(Phone.TYPES.TRAIN)).toBe(false)
  expect(phone.isType('random string')).toBe(false)
})

test('check phone location', () => {
  const phone = new Phone('id','name',Phone.TYPES.FIXED);
  const location = new Location('simID','panelId')
  phone.setLocation(location)
  expect(phone.getLocation()).toBe(location);
})