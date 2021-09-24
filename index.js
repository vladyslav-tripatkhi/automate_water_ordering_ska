import { remote } from 'webdriverio';
import { config } from 'dotenv';
import { program, InvalidArgumentError } from 'commander';

config();

let browser;

const getEnv = (envName, fallbackValue = undefined) => (
  envName in process.env ? process.env[envName] : fallbackValue
);

const clickOnElement = async (selector) => browser.executeScript(`$('${selector}')[0].click()`, []);

const setAttribute = async (selector, name, value) => {
  const attrValue = value || name;

  return browser.executeScript(`$('${selector}')[0].setAttribute('${name}', '${attrValue}')`, []);
};

const parseUaPhoneNumber = (value) => {
  const match = value.toString().match(/^\+38\(0\d{2}\)\d{3}-\d{2}-\d{2}$/);
  if (!match) {
    throw new InvalidArgumentError(
      'Phone number should be in format +38(0XX)-XXX-XX-XX',
    );
  }

  return value;
};

const setValueOfReadOnlyElement = async (selector, value, restore = false) => {
  const element = await browser.$(selector);
  await browser.executeScript(
    'arguments[0].removeAttribute("readonly");',
    [element],
  );
  await element.setValue(value);
  if (restore) {
    await setAttribute(selector, 'readonly');
  }
};

program
  .requiredOption('-n, --name <name>', 'Your name', getEnv('NAME'))
  .requiredOption('-p, --phone <phone>', 'Your phone number', parseUaPhoneNumber, getEnv('PHONE'))
  .requiredOption('-e, --email <email>', 'Your email address', getEnv('EMAIL'))
  .requiredOption('-s, --street <street>', 'Street to deliver to', getEnv('STREET'))
  .requiredOption('-h, --house <house>', 'House number to deliver to', getEnv('HOUSE'))
  .option('-en, --entrance <number>', 'House entrance to deliver to. Optional', getEnv('ENTRANCE'))
  .option('-ap, --apartment <number>', 'Apartment to deliver to. Optional', getEnv('APARTMENT'))
  .option('-b, --orderBottles <number>', 'Desired amount of bottles', getEnv('ORDER_BOTTLES', 3))
  .option('-x, --exchangeBottles <number>', 'Amount of bottles for exchange', getEnv('EXCHANGE_BOTTLES', 3))
  .option('-c, --callbackRequired <bool>', 'Do you need a callback from a manager', getEnv('CALLBACK_REQUIRED'))
  // dry-run is set to true for testing purposes
  .option('--dry-run', 'Run the program without placing an order', true)
  .option('--no-screenshot', 'Skip taking a screenshot before placing an order')
  .parse();

(async () => {
  const options = program.opts();

  browser = await remote({
    capabilities: { browserName: 'chrome' },
  });

  await browser.navigateTo('https://skandinavia.com.ua/ua/order-water/');

  await setValueOfReadOnlyElement('.js_change_quantity_water', options.orderBottles);
  await setValueOfReadOnlyElement('.js_change_quantity_buttle', options.exchangeBottles);

  const callbackCbId = `#perezvonCheck${options.callbackRequired === 'true' ? 1 : 2}`;
  await clickOnElement(callbackCbId);

  const nameInput = await browser.$('#name');
  await nameInput.setValue(options.name);

  const streetInput = await browser.$('#street');
  await streetInput.setValue(options.street);

  const houseInput = await browser.$('#house');
  await houseInput.setValue(options.house);

  const entranceInput = await browser.$('#entrance');
  await entranceInput.setValue(options.entrance);

  const aptInput = await browser.$('#apartment');
  await aptInput.setValue(options.apartment);

  const phoneInput = await browser.$('#phone');
  // TODO: Add format string
  await phoneInput.setValue(options.phone);

  const emailInput = await browser.$('#email');
  await emailInput.setValue(options.email);

  await clickOnElement('#total-checkbox');

  // Hide header for prettier screenshots
  if (options.screenshot) {
    await setAttribute('.header', 'hidden');
    await browser.saveScreenshot(`./screenshots/order-${new Date()}.png`);
  }

  if (!options.dryRun) {
    await clickOnElement('#submit-for-pay');
  }

  await browser.deleteSession();
})().catch((err) => {
  browser.deleteSession();
  throw new Error(err);
});
