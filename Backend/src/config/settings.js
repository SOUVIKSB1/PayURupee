const fs = require('fs');
const path = require('path');

const settingsFilePath = path.join(__dirname, 'settings.json');

const defaultSettings = {
  minReward: 5,
  maxReward: 25,
  maintenanceMode: false
};

function readSettings() {
  try {
    if (!fs.existsSync(settingsFilePath)) {
      fs.writeFileSync(settingsFilePath, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
    const data = fs.readFileSync(settingsFilePath, 'utf8');
    return { ...defaultSettings, ...JSON.parse(data) };
  } catch (err) {
    console.error('Error reading settings file:', err);
    return defaultSettings;
  }
}

function writeSettings(settings) {
  try {
    const current = readSettings();
    // Validate inputs
    const updated = {
      ...current,
      minReward: settings.minReward !== undefined ? Math.max(1, Number(settings.minReward)) : current.minReward,
      maxReward: settings.maxReward !== undefined ? Math.max(1, Number(settings.maxReward)) : current.maxReward,
      maintenanceMode: settings.maintenanceMode !== undefined ? Boolean(settings.maintenanceMode) : current.maintenanceMode
    };
    
    // Ensure min is less than or equal to max
    if (updated.minReward > updated.maxReward) {
      const temp = updated.minReward;
      updated.minReward = updated.maxReward;
      updated.maxReward = temp;
    }

    fs.writeFileSync(settingsFilePath, JSON.stringify(updated, null, 2));
    return updated;
  } catch (err) {
    console.error('Error writing settings file:', err);
    throw err;
  }
}

function getRandomReward() {
  const { minReward, maxReward } = readSettings();
  return Math.floor(minReward + Math.random() * (maxReward - minReward + 1));
}

module.exports = {
  readSettings,
  writeSettings,
  getRandomReward
};
