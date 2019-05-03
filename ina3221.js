'use strict'
/*
 * Node driver for INA3221 ported from Brett Marls'port of https://github.com/adafruit/Adafruit_INA219
 */
var i2c = require('../i2c-bus')	// https://github.com/fivdi/i2c-bus



/**
 * Callback for standard oncomplete
 *
 * @callback onCompleteCallback
 */

/**
 * Callback for returning a single value
 *
 * @callback onHaveValueCallback
 * @param {int} value - value returned by async operation 
 */

/*=========================================================================
I2C ADDRESS/BITS
-----------------------------------------------------------------------*/
const INA3221_ADDRESS                         = 0x40    // 1000000 (A0+A1=GND)
const INA3221_READ                            = 0x01
/*=========================================================================*/

/*=========================================================================
CONFIG REGISTER (R/W)
-----------------------------------------------------------------------*/
const INA3221_REG_CONFIG                      = 0x00
/*---------------------------------------------------------------------*/
const INA3221_CONFIG_RESET                    = 0x8000  // Reset Bit

const INA3221_CONFIG_ENABLE_CHAN1             = 0x4000  // Enable Channel 1
const INA3221_CONFIG_ENABLE_CHAN2             = 0x2000  // Enable Channel 2
const INA3221_CONFIG_ENABLE_CHAN3             = 0x1000  // Enable Channel 3

const INA3221_CONFIG_AVG2                     = 0x0800  // AVG Samples Bit 2 - See table 3 spec
const INA3221_CONFIG_AVG1                     = 0x0400  // AVG Samples Bit 1 - See table 3 spec
const INA3221_CONFIG_AVG0                     = 0x0200  // AVG Samples Bit 0 - See table 3 spec

const INA3221_CONFIG_VBUS_CT2                 = 0x0100  // VBUS bit 2 Conversion time - See table 4 spec
const INA3221_CONFIG_VBUS_CT1                 = 0x0080  // VBUS bit 1 Conversion time - See table 4 spec
const INA3221_CONFIG_VBUS_CT0                 = 0x0040  // VBUS bit 0 Conversion time - See table 4 spec

const INA3221_CONFIG_VSH_CT2                  = 0x0020  // Vshunt bit 2 Conversion time - See table 5 spec
const INA3221_CONFIG_VSH_CT1                  = 0x0010  // Vshunt bit 1 Conversion time - See table 5 spec
const INA3221_CONFIG_VSH_CT0                  = 0x0008  // Vshunt bit 0 Conversion time - See table 5 spec

const INA3221_CONFIG_MODE_2                   = 0x0004  // Operating Mode bit 2 - See table 6 spec
const INA3221_CONFIG_MODE_1                   = 0x0002  // Operating Mode bit 1 - See table 6 spec
const INA3221_CONFIG_MODE_0					  = 0x0001 // Operating Mode bit 0 - See table 6 spec

/*=========================================================================*/

/*=========================================================================
    SHUNT VOLTAGE REGISTER (R)
    -----------------------------------------------------------------------*/
const INA3221_REG_SHUNTVOLTAGE_1               = 0x01
/*=========================================================================*/

/*=========================================================================
    BUS VOLTAGE REGISTER (R)
    -----------------------------------------------------------------------*/
const INA3221_REG_BUSVOLTAGE_1                 = 0x02
/*=========================================================================*/


var Ina3221 = function(){}

Ina3221.prototype.init = function (address, busNumber) 
{

	// defaults
	address = typeof address !== 'undefined' ? address : INA3221_ADDRESS
	busNumber = typeof busNumber !== 'undefined' ? busNumber : 1
	
	this.log('init:: ' + address + ' | ' + busNumber)
	this.address = address
	this.shuntResistor = 0.1 
	
	this.wire = i2c.openSync(busNumber)
	const config =	INA3221_CONFIG_ENABLE_CHAN1 |
                    INA3221_CONFIG_ENABLE_CHAN2 |
                    INA3221_CONFIG_ENABLE_CHAN3 |
                    INA3221_CONFIG_AVG1 |
                    INA3221_CONFIG_VBUS_CT2 |
                    INA3221_CONFIG_VSH_CT2 |
                    INA3221_CONFIG_MODE_2 |
                    INA3221_CONFIG_MODE_1 |
                    INA3221_CONFIG_MODE_0

	this.writeRegister((INA3221_REG_CONFIG, config, function(){ this.log('configured')}))
}
 

Ina3221.prototype.enableLogging  = function (enable) 
{

	this.loggingEnabled = enable
}

/**
  * Reads a 16 bit value over I2C
  * @param {integer} register - Register to read from (One of INA3221_REG_*)
  * @param {integer} value - Value to be written
  * @param {writeRegisterCallback} callback - Callback to be invoked when complete
  */
Ina3221.prototype.writeRegister  = function (register, value, callback) 
{
	var bytes = new Buffer(2)

	bytes[0] = (value >> 8) & 0xFF
	bytes[1] = value & 0xFF
		 
	this.wire.writeI2cBlockSync(this.address, register, 2, bytes)
	callback(null)
}

/**
  * Reads a 16 bit value over I2C
  * @param {integer} register - Register to read from (One of INA3221_REG_*)
  * @param {onHaveValueCallback} callback - Callback to be invoked when complete
  */
Ina3221.prototype.readRegister  = function (register, callback) 
{
	var res = new Buffer(2)
	
	this.wire.readI2cBlockSync(this.address, register, 2, res)
	
	var value = res.readInt16BE()
	
	this.log('::readRegister => [' + res[0] + ', ' + res[1] + ']')
		
	callback(value)
}


Ina3221.prototype.log  = function (s) 
{
	
	if (this.loggingEnabled)
		console.log(s)
}

/**
  * Reads the raw bus voltage 
  * @param {onHaveValueCallback} callback - Callback to be invoked when complete. 
  */
Ina3221.prototype.getBusVoltage_raw  = function (channel, callback) 
{
	channel = channel === undefined ? 1 : channel
	this.log('getBusVoltage_raw')
	var $this = this

	this.readRegister(INA3221_REG_BUSVOLTAGE_1+(channel -1) * 2, function (value) 
	{
		$this.log('getBusVoltage_raw RET: ' + value)

		//  Shift to the right 3 to drop CNVR and OVF and multiply by LSB
		callback( (value >> 3) * 4)

	})
}


/**
  * Reads the raw shunt voltage 
  * @param {onHaveValueCallback} callback - Callback to be invoked when complete. 
  */
Ina3221.prototype.getShuntVoltage_raw  = function (channel, callback) 
{
	channel = channel === undefined ? 1 : channel
	this.log('getShuntVoltage_raw')
	var $this = this

	this.readRegister(INA3221_REG_BUSVOLTAGE_1+(channel -1) * 2, function (value) 
	{

		$this.log('getShuntVoltage_raw RET: ' + value)
		callback(value)
	})
}



/**
  *  Gets the bus voltage in volts 
  * @param {onHaveValueCallback} callback - Callback to be invoked when complete. 
  */
Ina3221.prototype.getBusVoltage_V  = function (channel, callback) 
{
	channel = channel === undefined ? 1 : channel

	this.getBusVoltage_raw(channel, function(result) 
	{
		callback(result * 0.001)
	})
	
}

/**
  * Gets the current value in mA, taking into account the config settings and current LSB
  * @param {onHaveValueCallback} callback - Callback to be invoked when complete. 
  */

Ina3221.prototype.getCurrent_mA  = function (channel, callback) 
{
	channel = channel === undefined ? 1 : channel

	var $this = this
	this.getShuntVoltage_raw(channel)/ this.shuntResistor

	this.getShuntVoltage_raw(channel ,function(value)
	{
		callback( value / $this.shuntResistor)
	}
	)
}

	
// export is a Singleton
module.exports = new Ina3221()

