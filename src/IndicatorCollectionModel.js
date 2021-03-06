// vi: sw=2 sts=2 et

const Lang = imports.lang;
const Signals = imports.signals;

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Local = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Local.imports.convenience;

const INDICATORS_KEY = "indicators";



const ConfigModel = new Lang.Class({
  Name: "ConfigModel",

  _init: function (attributes) {
    this.attributes = attributes;
  },

  set: function (key, value) {
    this.attributes[key] = value;
    this.emit('update', key, value);
  },

  get: function (key) {
    return this.attributes[key];
  },

  toString: function () {
    return JSON.stringify(this.attributes);
  },

  destroy: function () {
    this.disconnectAll();
  }
});

Signals.addSignalMethods(ConfigModel.prototype);



const IndicatorCollectionModel = new GObject.Class({
  Name: "BitcoinMarkets.IndicatorCollectionModel",
  GTypeName: "IndicatorCollectionModel",
  Extends: Gtk.ListStore,

  Columns: {
    LABEL: 0,
    CONFIG: 1
  },

  _init: function (params, apiProvider) {
    this.parent(params);

    this._apiProvider = apiProvider;

    this.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    this._settings = Convenience.getSettings();

    this._reloadFromSettings();

    var flag;

    let mutex = function (func) {
      return function () {
        if (!flag) {
          flag = true;
          func.apply(null, arguments);
          flag = false;
        }
      }
    };

    this.connect('row-changed', mutex(Lang.bind(this, this._onRowChanged)));

    this.connect('row-inserted', mutex(Lang.bind(this, this._onRowInserted)));

    this.connect('row-deleted', mutex(Lang.bind(this, this._onRowDeleted)));
  },

  size: function () {
    return this._configs.length;
  },

  getConfig: function (iter) {
    let json = this.get_value(iter, this.Columns.CONFIG);
    let config = new ConfigModel(JSON.parse(json));

    config.connect('update', function () {
      this.set(
        iter,
        [this.Columns.CONFIG],
        [config.toString()]
      );
    }.bind(this));

    return config;
  },

  _getLabel: function (config) {
    return this._apiProvider.apis[config.api].getLabel(config);
  },

  _getDefaults: function () {
    return {
      api: 'bitcoinaverage',
      currency: 'USD',
      attribute: 'last'
    };
  },

  _reloadFromSettings: function () {
    this.clear();

    this._configs = this._settings.get_strv(INDICATORS_KEY);

    for each (let json in this._configs) {
      this.set(
        this.append(),
        [this.Columns.LABEL, this.Columns.CONFIG],
        [this._getLabel(JSON.parse(json)), json]
      );
    }
  },

  _writeSettings: function () {
    let [res, iter] = this.get_iter_first();

    this._configs = [];

    while (res) {
      this._configs.push(this.get_value(iter, this.Columns.CONFIG));
      res = this.iter_next(iter);
    };

    this._settings.set_strv(INDICATORS_KEY, this._configs);
  },

  _onRowChanged: function (self, path, iter) {
    let configs = this._settings.get_strv(INDICATORS_KEY);
    let [i, ] = path.get_indices();

    let config = configs[i] = this.get_value(iter, this.Columns.CONFIG);

    this.set(
      iter,
      [this.Columns.LABEL, this.Columns.CONFIG],
      [this._getLabel(JSON.parse(config)), config]
    );

    this._writeSettings();
  },

  _onRowInserted: function (self, path, iter) {
    let [i, ] = path.get_indices();
    let configs = this._settings.get_strv(INDICATORS_KEY);
    let defaults = this._getDefaults();

    this.set(
      iter,
      [this.Columns.LABEL, this.Columns.CONFIG],
      [this._getLabel(defaults), JSON.stringify(defaults)]
    );

    this._writeSettings();
  },

  _onRowDeleted: function (self, path, iter) {
    this._writeSettings();
  }
});
