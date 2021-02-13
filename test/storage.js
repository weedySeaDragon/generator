'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FileEditor = require('mem-fs-editor');
const helpers = require('yeoman-test');
const Storage = require('../lib/util/storage');
const memFs = require('mem-fs');

const tmpdir = path.join(os.tmpdir(), 'yeoman-storage');

function rm(filepath) {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(path);
  }
}

describe('Storage', () => {
  beforeEach(helpers.setUpTestDirectory(tmpdir));

  beforeEach(function () {
    this.beforeDir = process.cwd();
    this.storePath = path.join(tmpdir, 'new-config.json');
    this.memFs = memFs.create();
    this.fs = FileEditor.create(this.memFs);
    this.store = new Storage('test', this.fs, this.storePath);
    this.store.set('foo', 'bar');
  });

  afterEach(function () {
    const json = this.fs.read(this.storePath);
    assert.ok(json.endsWith('\n'));
    assert.ok(!json.endsWith('\n\n'));
    rm(this.storePath);
    process.chdir(this.beforeDir);
  });

  describe('.constructor()', () => {
    it('require a parameter', () => {
      assert.throws(() => {
        new Storage(); // eslint-disable-line no-new
      });
    });

    it('require at least 2 parameter', () => {
      assert.throws(() => {
        new Storage({}); // eslint-disable-line no-new
      });
    });

    it('take a path parameter', function () {
      const store = new Storage(
        'test',
        this.fs,
        path.join(__dirname, './fixtures/config.json')
      );
      assert.equal(store.get('testFramework'), 'mocha');
      assert.ok(store.existed);
    });

    it('take a fs and path parameter without name', function () {
      const store = new Storage(
        this.fs,
        path.join(__dirname, './fixtures/config.json')
      );
      assert.equal(store.get('test').testFramework, 'mocha');
      assert.ok(store.existed);
    });
  });

  it('namespace each store sharing the same store file', function () {
    const store = new Storage('foobar', this.fs, this.storePath);
    store.set('foo', 'something else');
    assert.equal(this.store.get('foo'), 'bar');
  });

  it('a config path is required', () => {
    assert.throws(function () {
      new Storage('yo', this.fs); // eslint-disable-line no-new
    });
  });

  describe('#get()', () => {
    beforeEach(function () {
      this.store.set('testFramework', 'mocha');
      this.store.set('name', 'test');
    });

    it('get values', function () {
      assert.equal(this.store.get('testFramework'), 'mocha');
      assert.equal(this.store.get('name'), 'test');
    });
  });

  describe('#set()', () => {
    it('set values', function () {
      this.store.set('name', 'Yeoman!');
      assert.equal(this.store.get('name'), 'Yeoman!');
    });

    it('set multiple values at once', function () {
      this.store.set({foo: 'bar', john: 'doe'});
      assert.equal(this.store.get('foo'), 'bar');
      assert.equal(this.store.get('john'), 'doe');
    });

    it('throws when invalid JSON values are passed', function () {
      assert.throws(this.store.set.bind(this, 'foo', () => {}));
    });

    it('save on each changes', function () {
      this.store.set('foo', 'bar');
      assert.equal(this.fs.readJSON(this.storePath).test.foo, 'bar');
      this.store.set('foo', 'oo');
      assert.equal(this.fs.readJSON(this.storePath).test.foo, 'oo');
    });

    describe('@return', () => {
      beforeEach(function () {
        this.storePath = path.join(tmpdir, 'setreturn.json');
        this.store = new Storage('test', this.fs, this.storePath);
      });

      afterEach(function () {
        rm(this.storePath);
      });

      it('the saved value (with key)', function () {
        assert.equal(this.store.set('name', 'Yeoman!'), 'Yeoman!');
      });

      it('the saved value (without key)', function () {
        assert.deepEqual(this.store.set({foo: 'bar', john: 'doe'}), {
          foo: 'bar',
          john: 'doe'
        });
      });

      it('the saved value (update values)', function () {
        this.store.set({foo: 'bar', john: 'doe'});
        assert.deepEqual(this.store.set({foo: 'moo'}), {
          foo: 'moo',
          john: 'doe'
        });
      });
    });

    describe('when multiples instances share the same file', () => {
      beforeEach(function () {
        this.store = new Storage('test', this.fs, this.storePath);
        this.store.set('foo', 'bar');
        this.store2 = new Storage('test2', this.fs, this.storePath);
      });

      it('only update modified namespace', function () {
        this.store2.set('bar', 'foo');
        this.store.set('foo', 'bar');

        const json = this.fs.readJSON(this.storePath);
        assert.equal(json.test.foo, 'bar');
        assert.equal(json.test2.bar, 'foo');
      });
    });

    describe('when multiples instances share the same namespace', () => {
      beforeEach(function () {
        this.store = new Storage('test', this.fs, this.storePath);
        this.store.set('foo', 'bar');
        this.store2 = new Storage('test', this.fs, this.storePath);
      });

      it('only update modified namespace', function () {
        this.store2.set('bar', 'foo');
        this.store.set('foo', 'bar');

        assert.equal(this.store2.get('foo'), 'bar');
        assert.equal(this.store.get('bar'), 'foo');

        const json = this.fs.readJSON(this.storePath);
        assert.equal(json.test.foo, 'bar');
        assert.equal(json.test.bar, 'foo');
      });
    });
  });

  describe('#getAll()', () => {
    beforeEach(function () {
      this.store.set({foo: 'bar', john: 'doe'});
    });

    it('get all values', function () {
      assert.deepEqual(this.store.getAll().foo, 'bar');
    });

    it('does not return a reference to the inner store', function () {
      this.store.getAll().foo = 'uhoh';
      assert.equal(this.store.getAll().foo, 'bar');
    });
  });

  describe('#delete()', () => {
    beforeEach(function () {
      this.store.set('name', 'test');
    });

    it('delete value', function () {
      this.store.delete('name');
      assert.equal(this.store.get('name'), undefined);
    });
  });

  describe('#defaults()', () => {
    beforeEach(function () {
      this.store.set('val1', 1);
    });

    it('set defaults values if not predefined', function () {
      this.store.defaults({val1: 3, val2: 4});

      assert.equal(this.store.get('val1'), 1);
      assert.equal(this.store.get('val2'), 4);
    });

    it('require an Object as argument', function () {
      assert.throws(this.store.defaults.bind(this.store, 'foo'));
    });

    describe('@return', () => {
      beforeEach(function () {
        this.storePath = path.join(tmpdir, 'defaultreturn.json');
        this.store = new Storage('test', this.fs, this.storePath);
        this.store.set('val1', 1);
        this.store.set('foo', 'bar');
      });

      afterEach(function () {
        rm(this.storePath);
      });

      it('the saved value when passed an empty object', function () {
        assert.deepEqual(this.store.defaults({}), {foo: 'bar', val1: 1});
      });

      it('the saved value when passed the same key', function () {
        assert.deepEqual(this.store.defaults({foo: 'baz'}), {
          foo: 'bar',
          val1: 1
        });
      });

      it('the saved value when passed new key', function () {
        assert.deepEqual(this.store.defaults({food: 'pizza'}), {
          foo: 'bar',
          val1: 1,
          food: 'pizza'
        });
      });
    });
  });

  describe('#merge()', () => {
    beforeEach(function () {
      this.store.set('val1', 1);
    });

    it('should merge values if not predefined', function () {
      this.store.merge({val1: 3, val2: 4});

      assert.strictEqual(this.store.get('val1'), 3);
      assert.strictEqual(this.store.get('val2'), 4);
    });

    it('should require an Object as argument', function () {
      assert.throws(this.store.defaults.bind(this.store, 'foo'));
    });

    describe('@return', () => {
      beforeEach(function () {
        this.storePath = path.join(tmpdir, 'defaultreturn.json');
        this.store = new Storage('test', this.fs, this.storePath);
        this.store.set('val1', 1);
        this.store.set('foo', 'bar');
      });

      afterEach(function () {
        rm(this.storePath);
      });

      it('should return the original object', function () {
        assert.deepStrictEqual(this.store.merge({}), {foo: 'bar', val1: 1});
      });

      it('should return an object with replaced values', function () {
        assert.deepStrictEqual(this.store.merge({foo: 'baz'}), {
          foo: 'baz',
          val1: 1
        });
      });

      it('should return an object with new values', function () {
        assert.deepStrictEqual(this.store.merge({food: 'pizza'}), {
          foo: 'bar',
          val1: 1,
          food: 'pizza'
        });
      });
    });
  });

  it('stores sharing the same store file with and without namespace', function () {
    const store = new Storage(this.fs, this.storePath);
    store.set('test', {bar: 'foo'});
    assert.equal(this.store.get('bar'), 'foo');
  });

  it('#getPath() & #setPath()', function () {
    this.store.set('name', {name: 'test'});
    assert.ok(this.store.getPath('name'));
    assert.equal(this.store.getPath('name.name'), 'test');
    assert.equal(this.store.setPath('name.name', 'changed'), 'changed');
    assert.equal(this.store.getPath('name.name'), 'changed');
    assert.equal(this.store.get('name').name, 'changed');
  });

  describe('#getStorage()', () => {
    beforeEach(function () {
      this.pathStore = this.store.createStorage('path');
    });

    it('get and set value', function () {
      assert.equal(this.pathStore.setPath('name', 'initial'), 'initial');
      assert.equal(this.store.get('path').name, 'initial');
      this.store.set('path', {name: 'test'});
      assert.equal(this.pathStore.get('name'), 'test');
      this.pathStore.set('name', 'changed');
      assert.equal(this.store.get('path').name, 'changed');
    });
  });

  describe('.constructor() with lodashPath', () => {
    beforeEach(function () {
      this.pathStore = new Storage('test.path', this.fs, this.storePath, true);
    });

    it('get and set value', function () {
      assert.equal(this.pathStore.setPath('name', 'initial'), 'initial');
      assert.equal(this.store.get('path').name, 'initial');
      this.store.set('path', {name: 'test'});
      assert.equal(this.pathStore.get('name'), 'test');
      this.pathStore.set('name', 'changed');
      assert.equal(this.store.get('path').name, 'changed');
    });
  });

  describe('#createProxy()', () => {
    let proxy;
    beforeEach(function () {
      proxy = this.store.createProxy();
    });

    it('sets values', function () {
      proxy.name = 'Yeoman!';
      assert.equal(this.store.get('name'), 'Yeoman!');
    });

    it('sets multiple values at once', function () {
      Object.assign(proxy, {foo: 'bar', john: 'doe'});
      assert.equal(this.store.get('foo'), 'bar');
      assert.equal(this.store.get('john'), 'doe');
    });

    it('gets values', function () {
      this.store.set('name', 'Yeoman!');
      assert.equal(proxy.name, 'Yeoman!');
    });

    it('works with spread operator', function () {
      this.store.set({foo: 'bar', john: 'doe'});
      const store = {...proxy};
      assert.equal(store.foo, 'bar');
      assert.equal(store.john, 'doe');
    });

    it('works with in operator', function () {
      this.store.set({foo: 'bar', john: 'doe'});
      assert('foo' in proxy);
      assert(!('foo2' in proxy));
    });

    it('works with deepEquals', function () {
      this.store.set({foo: 'bar', john: 'doe'});
      assert.deepStrictEqual({...proxy}, {foo: 'bar', john: 'doe'});
    });
  });

  describe('caching', () => {
    beforeEach(function () {
      // Make sure the cache is loaded.
      // on instantiation a change event is emitted when the file loads to mem-fs
      this.store.get('foo');
    });

    it('should load', function () {
      assert(this.store._cachedStore);
    });

    it('should not load when disabled', function () {
      const store = new Storage('test', this.fs, this.storePath, {
        disableCache: true
      });
      assert(store._cachedStore === undefined);
      store.get('foo');
      assert(store._cachedStore === undefined);
    });

    it('cleanups when the file changes', function () {
      this.fs.writeJSON(this.store.path, {});
      assert(this.store._cachedStore === undefined);
    });

    it("doesn't cleanup when another file changes", function () {
      this.fs.write('a.txt', 'anything');
      assert(this.store._cachedStore);
    });

    it('cleanups when per file cache is disabled and another file changes', function () {
      this.fs.writeJSON(this.store.path, {disableCacheByFile: true});
      this.fs.write('a.txt', 'anything');
      assert(this.store._cachedStore === undefined);
    });

    // Compatibility for mem-fs <= 1.1.3
    it('cleanups when change event argument is undefined', function () {
      this.memFs.emit('change');
      assert(this.store._cachedStore === undefined);
    });
  });
});
