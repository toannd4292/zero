// packages/alpinejs/src/scheduler.js
var flushPending = false;
var flushing = false;
var queue = [];
var lastFlushedIndex = -1;

function scheduler(callback) {
  queueJob(callback);
}

function queueJob(job) {
  if (!queue.includes(job)) queue.push(job);
  queueFlush();
}

function dequeueJob(job) {
  let index = queue.indexOf(job);
  if (index !== -1 && index > lastFlushedIndex) queue.splice(index, 1);
}

function queueFlush() {
  if (!flushing && !flushPending) {
    flushPending = true;
    queueMicrotask(flushJobs);
  }
}

function flushJobs() {
  flushPending = false;
  flushing = true;

  for (let i = 0; i < queue.length; i++) {
    queue[i]();
    lastFlushedIndex = i;
  }

  queue.length = 0;
  lastFlushedIndex = -1;
  flushing = false;
} // packages/alpinejs/src/reactivity.js


var reactive;
var effect;
var release;
var raw;
var shouldSchedule = true;

function disableEffectScheduling(callback) {
  shouldSchedule = false;
  callback();
  shouldSchedule = true;
}

function setReactivityEngine(engine) {
  reactive = engine.reactive;
  release = engine.release;

  effect = callback => engine.effect(callback, {
    scheduler: task => {
      if (shouldSchedule) {
        scheduler(task);
      } else {
        task();
      }
    }
  });

  raw = engine.raw;
}

function overrideEffect(override) {
  effect = override;
}

function elementBoundEffect(el) {
  let cleanup2 = () => {};

  let wrappedEffect = callback => {
    let effectReference = effect(callback);

    if (!el._x_effects) {
      el._x_effects = /* @__PURE__ */new Set();

      el._x_runEffects = () => {
        el._x_effects.forEach(i => i());
      };
    }

    el._x_effects.add(effectReference);

    cleanup2 = () => {
      if (effectReference === void 0) return;

      el._x_effects.delete(effectReference);

      release(effectReference);
    };

    return effectReference;
  };

  return [wrappedEffect, () => {
    cleanup2();
  }];
} // packages/alpinejs/src/mutation.js


var onAttributeAddeds = [];
var onElRemoveds = [];
var onElAddeds = [];

function onElAdded(callback) {
  onElAddeds.push(callback);
}

function onElRemoved(el, callback) {
  if (typeof callback === "function") {
    if (!el._x_cleanups) el._x_cleanups = [];

    el._x_cleanups.push(callback);
  } else {
    callback = el;
    onElRemoveds.push(callback);
  }
}

function onAttributesAdded(callback) {
  onAttributeAddeds.push(callback);
}

function onAttributeRemoved(el, name, callback) {
  if (!el._x_attributeCleanups) el._x_attributeCleanups = {};
  if (!el._x_attributeCleanups[name]) el._x_attributeCleanups[name] = [];

  el._x_attributeCleanups[name].push(callback);
}

function cleanupAttributes(el, names) {
  if (!el._x_attributeCleanups) return;
  Object.entries(el._x_attributeCleanups).forEach(_ref4 => {
    let [name, value] = _ref4;

    if (names === void 0 || names.includes(name)) {
      value.forEach(i => i());
      delete el._x_attributeCleanups[name];
    }
  });
}

var observer = new MutationObserver(onMutate);
var currentlyObserving = false;

function startObservingMutations() {
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true
  });
  currentlyObserving = true;
}

function stopObservingMutations() {
  flushObserver();
  observer.disconnect();
  currentlyObserving = false;
}

var recordQueue = [];
var willProcessRecordQueue = false;

function flushObserver() {
  recordQueue = recordQueue.concat(observer.takeRecords());

  if (recordQueue.length && !willProcessRecordQueue) {
    willProcessRecordQueue = true;
    queueMicrotask(() => {
      processRecordQueue();
      willProcessRecordQueue = false;
    });
  }
}

function processRecordQueue() {
  onMutate(recordQueue);
  recordQueue.length = 0;
}

function mutateDom(callback) {
  if (!currentlyObserving) return callback();
  stopObservingMutations();
  let result = callback();
  startObservingMutations();
  return result;
}

var isCollecting = false;
var deferredMutations = [];

function deferMutations() {
  isCollecting = true;
}

function flushAndStopDeferringMutations() {
  isCollecting = false;
  onMutate(deferredMutations);
  deferredMutations = [];
}

function onMutate(mutations) {
  if (isCollecting) {
    deferredMutations = deferredMutations.concat(mutations);
    return;
  }

  let addedNodes = [];
  let removedNodes = [];
  let addedAttributes = /* @__PURE__ */new Map();
  let removedAttributes = /* @__PURE__ */new Map();

  for (let i = 0; i < mutations.length; i++) {
    if (mutations[i].target._x_ignoreMutationObserver) continue;

    if (mutations[i].type === "childList") {
      mutations[i].addedNodes.forEach(node => node.nodeType === 1 && addedNodes.push(node));
      mutations[i].removedNodes.forEach(node => node.nodeType === 1 && removedNodes.push(node));
    }

    if (mutations[i].type === "attributes") {
      let el = mutations[i].target;
      let name = mutations[i].attributeName;
      let oldValue = mutations[i].oldValue;

      let add2 = () => {
        if (!addedAttributes.has(el)) addedAttributes.set(el, []);
        addedAttributes.get(el).push({
          name,
          value: el.getAttribute(name)
        });
      };

      let remove = () => {
        if (!removedAttributes.has(el)) removedAttributes.set(el, []);
        removedAttributes.get(el).push(name);
      };

      if (el.hasAttribute(name) && oldValue === null) {
        add2();
      } else if (el.hasAttribute(name)) {
        remove();
        add2();
      } else {
        remove();
      }
    }
  }

  removedAttributes.forEach((attrs, el) => {
    cleanupAttributes(el, attrs);
  });
  addedAttributes.forEach((attrs, el) => {
    onAttributeAddeds.forEach(i => i(el, attrs));
  });

  for (let node of removedNodes) {
    if (addedNodes.includes(node)) continue;
    onElRemoveds.forEach(i => i(node));

    if (node._x_cleanups) {
      while (node._x_cleanups.length) node._x_cleanups.pop()();
    }
  }

  addedNodes.forEach(node => {
    node._x_ignoreSelf = true;
    node._x_ignore = true;
  });

  for (let node of addedNodes) {
    if (removedNodes.includes(node)) continue;
    if (!node.isConnected) continue;
    delete node._x_ignoreSelf;
    delete node._x_ignore;
    onElAddeds.forEach(i => i(node));
    node._x_ignore = true;
    node._x_ignoreSelf = true;
  }

  addedNodes.forEach(node => {
    delete node._x_ignoreSelf;
    delete node._x_ignore;
  });
  addedNodes = null;
  removedNodes = null;
  addedAttributes = null;
  removedAttributes = null;
} // packages/alpinejs/src/scope.js


function scope(node) {
  return mergeProxies(closestDataStack(node));
}

function addScopeToNode(node, data2, referenceNode) {
  node._x_dataStack = [data2, ...closestDataStack(referenceNode || node)];
  return () => {
    node._x_dataStack = node._x_dataStack.filter(i => i !== data2);
  };
}

function refreshScope(element, scope2) {
  let existingScope = element._x_dataStack[0];
  Object.entries(scope2).forEach(_ref5 => {
    let [key, value] = _ref5;
    existingScope[key] = value;
  });
}

function closestDataStack(node) {
  if (node._x_dataStack) return node._x_dataStack;

  if (typeof ShadowRoot === "function" && node instanceof ShadowRoot) {
    return closestDataStack(node.host);
  }

  if (!node.parentNode) {
    return [];
  }

  return closestDataStack(node.parentNode);
}

function mergeProxies(objects) {
  let thisProxy = new Proxy({}, {
    ownKeys: () => {
      return Array.from(new Set(objects.flatMap(i => Object.keys(i))));
    },
    has: (target, name) => {
      return objects.some(obj => obj.hasOwnProperty(name));
    },
    get: (target, name) => {
      return (objects.find(obj => {
        if (obj.hasOwnProperty(name)) {
          let descriptor = Object.getOwnPropertyDescriptor(obj, name);

          if (descriptor.get && descriptor.get._x_alreadyBound || descriptor.set && descriptor.set._x_alreadyBound) {
            return true;
          }

          if ((descriptor.get || descriptor.set) && descriptor.enumerable) {
            let getter = descriptor.get;
            let setter = descriptor.set;
            let property = descriptor;
            getter = getter && getter.bind(thisProxy);
            setter = setter && setter.bind(thisProxy);
            if (getter) getter._x_alreadyBound = true;
            if (setter) setter._x_alreadyBound = true;
            Object.defineProperty(obj, name, { ...property,
              get: getter,
              set: setter
            });
          }

          return true;
        }

        return false;
      }) || {})[name];
    },
    set: (target, name, value) => {
      let closestObjectWithKey = objects.find(obj => obj.hasOwnProperty(name));

      if (closestObjectWithKey) {
        closestObjectWithKey[name] = value;
      } else {
        objects[objects.length - 1][name] = value;
      }

      return true;
    }
  });
  return thisProxy;
} // packages/alpinejs/src/interceptor.js


function initInterceptors(data2) {
  let isObject2 = val => typeof val === "object" && !Array.isArray(val) && val !== null;

  let recurse = function (obj) {
    let basePath = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";
    Object.entries(Object.getOwnPropertyDescriptors(obj)).forEach(_ref6 => {
      let [key, {
        value,
        enumerable
      }] = _ref6;
      if (enumerable === false || value === void 0) return;
      let path = basePath === "" ? key : `${basePath}.${key}`;

      if (typeof value === "object" && value !== null && value._x_interceptor) {
        obj[key] = value.initialize(data2, path, key);
      } else {
        if (isObject2(value) && value !== obj && !(value instanceof Element)) {
          recurse(value, path);
        }
      }
    });
  };

  return recurse(data2);
}

function interceptor(callback) {
  let mutateObj = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
  let obj = {
    initialValue: void 0,
    _x_interceptor: true,

    initialize(data2, path, key) {
      return callback(this.initialValue, () => get(data2, path), value => set(data2, path, value), path, key);
    }

  };
  mutateObj(obj);
  return initialValue => {
    if (typeof initialValue === "object" && initialValue !== null && initialValue._x_interceptor) {
      let initialize = obj.initialize.bind(obj);

      obj.initialize = (data2, path, key) => {
        let innerValue = initialValue.initialize(data2, path, key);
        obj.initialValue = innerValue;
        return initialize(data2, path, key);
      };
    } else {
      obj.initialValue = initialValue;
    }

    return obj;
  };
}

function get(obj, path) {
  return path.split(".").reduce((carry, segment) => carry[segment], obj);
}

function set(obj, path, value) {
  if (typeof path === "string") path = path.split(".");
  if (path.length === 1) obj[path[0]] = value;else if (path.length === 0) throw error;else {
    if (obj[path[0]]) return set(obj[path[0]], path.slice(1), value);else {
      obj[path[0]] = {};
      return set(obj[path[0]], path.slice(1), value);
    }
  }
} // packages/alpinejs/src/magics.js


var magics = {};

function magic(name, callback) {
  magics[name] = callback;
}

function injectMagics(obj, el) {
  Object.entries(magics).forEach(_ref7 => {
    let [name, callback] = _ref7;
    Object.defineProperty(obj, `$${name}`, {
      get() {
        let [utilities, cleanup2] = getElementBoundUtilities(el);
        utilities = {
          interceptor,
          ...utilities
        };
        onElRemoved(el, cleanup2);
        return callback(el, utilities);
      },

      enumerable: false
    });
  });
  return obj;
} // packages/alpinejs/src/utils/error.js


function tryCatch(el, expression, callback) {
  try {
    for (var _len2 = arguments.length, args = new Array(_len2 > 3 ? _len2 - 3 : 0), _key2 = 3; _key2 < _len2; _key2++) {
      args[_key2 - 3] = arguments[_key2];
    }

    return callback(...args);
  } catch (e) {
    handleError(e, el, expression);
  }
}

function handleError(error2, el) {
  let expression = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : void 0;
  Object.assign(error2, {
    el,
    expression
  });
  console.warn(`Alpine Expression Error: ${error2.message}

${expression ? 'Expression: "' + expression + '"\n\n' : ""}`, el);
  setTimeout(() => {
    throw error2;
  }, 0);
} // packages/alpinejs/src/evaluator.js


var shouldAutoEvaluateFunctions = true;

function dontAutoEvaluateFunctions(callback) {
  let cache = shouldAutoEvaluateFunctions;
  shouldAutoEvaluateFunctions = false;
  callback();
  shouldAutoEvaluateFunctions = cache;
}

function evaluate(el, expression) {
  let extras = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  let result;
  evaluateLater(el, expression)(value => result = value, extras);
  return result;
}

function evaluateLater() {
  return theEvaluatorFunction(...arguments);
}

var theEvaluatorFunction = normalEvaluator;

function setEvaluator(newEvaluator) {
  theEvaluatorFunction = newEvaluator;
}

function normalEvaluator(el, expression) {
  let overriddenMagics = {};
  injectMagics(overriddenMagics, el);
  let dataStack = [overriddenMagics, ...closestDataStack(el)];
  let evaluator = typeof expression === "function" ? generateEvaluatorFromFunction(dataStack, expression) : generateEvaluatorFromString(dataStack, expression, el);
  return tryCatch.bind(null, el, expression, evaluator);
}

function generateEvaluatorFromFunction(dataStack, func) {
  return function () {
    let receiver = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
    let {
      scope: scope2 = {},
      params = []
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    let result = func.apply(mergeProxies([scope2, ...dataStack]), params);
    runIfTypeOfFunction(receiver, result);
  };
}

var evaluatorMemo = {};

function generateFunctionFromString(expression, el) {
  if (evaluatorMemo[expression]) {
    return evaluatorMemo[expression];
  }

  let AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let rightSideSafeExpression = /^[\n\s]*if.*\(.*\)/.test(expression) || /^(let|const)\s/.test(expression) ? `(async()=>{ ${expression} })()` : expression;

  const safeAsyncFunction = () => {
    try {
      return new AsyncFunction(["__self", "scope"], `with (scope) { __self.result = ${rightSideSafeExpression} }; __self.finished = true; return __self.result;`);
    } catch (error2) {
      handleError(error2, el, expression);
      return Promise.resolve();
    }
  };

  let func = safeAsyncFunction();
  evaluatorMemo[expression] = func;
  return func;
}

function generateEvaluatorFromString(dataStack, expression, el) {
  let func = generateFunctionFromString(expression, el);
  return function () {
    let receiver = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
    let {
      scope: scope2 = {},
      params = []
    } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    func.result = void 0;
    func.finished = false;
    let completeScope = mergeProxies([scope2, ...dataStack]);

    if (typeof func === "function") {
      let promise = func(func, completeScope).catch(error2 => handleError(error2, el, expression));

      if (func.finished) {
        runIfTypeOfFunction(receiver, func.result, completeScope, params, el);
        func.result = void 0;
      } else {
        promise.then(result => {
          runIfTypeOfFunction(receiver, result, completeScope, params, el);
        }).catch(error2 => handleError(error2, el, expression)).finally(() => func.result = void 0);
      }
    }
  };
}

function runIfTypeOfFunction(receiver, value, scope2, params, el) {
  if (shouldAutoEvaluateFunctions && typeof value === "function") {
    let result = value.apply(scope2, params);

    if (result instanceof Promise) {
      result.then(i => runIfTypeOfFunction(receiver, i, scope2, params)).catch(error2 => handleError(error2, el, value));
    } else {
      receiver(result);
    }
  } else if (typeof value === "object" && value instanceof Promise) {
    value.then(i => receiver(i));
  } else {
    receiver(value);
  }
} // packages/alpinejs/src/directives.js


var prefixAsString = "x-";

function prefix() {
  let subject = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "";
  return prefixAsString + subject;
}

function setPrefix(newPrefix) {
  prefixAsString = newPrefix;
}

var directiveHandlers = {};

function directive(name, callback) {
  directiveHandlers[name] = callback;
  return {
    before(directive2) {
      if (!directiveHandlers[directive2]) {
        console.warn("Cannot find directive `${directive}`. `${name}` will use the default order of execution");
        return;
      }

      const pos = directiveOrder.indexOf(directive2);
      directiveOrder.splice(pos >= 0 ? pos : directiveOrder.indexOf("DEFAULT"), 0, name);
    }

  };
}

function directives(el, attributes, originalAttributeOverride) {
  attributes = Array.from(attributes);

  if (el._x_virtualDirectives) {
    let vAttributes = Object.entries(el._x_virtualDirectives).map(_ref8 => {
      let [name, value] = _ref8;
      return {
        name,
        value
      };
    });
    let staticAttributes = attributesOnly(vAttributes);
    vAttributes = vAttributes.map(attribute => {
      if (staticAttributes.find(attr => attr.name === attribute.name)) {
        return {
          name: `x-bind:${attribute.name}`,
          value: `"${attribute.value}"`
        };
      }

      return attribute;
    });
    attributes = attributes.concat(vAttributes);
  }

  let transformedAttributeMap = {};
  let directives2 = attributes.map(toTransformedAttributes((newName, oldName) => transformedAttributeMap[newName] = oldName)).filter(outNonAlpineAttributes).map(toParsedDirectives(transformedAttributeMap, originalAttributeOverride)).sort(byPriority);
  return directives2.map(directive2 => {
    return getDirectiveHandler(el, directive2);
  });
}

function attributesOnly(attributes) {
  return Array.from(attributes).map(toTransformedAttributes()).filter(attr => !outNonAlpineAttributes(attr));
}

var isDeferringHandlers = false;
var directiveHandlerStacks = /* @__PURE__ */new Map();
var currentHandlerStackKey = Symbol();

function deferHandlingDirectives(callback) {
  isDeferringHandlers = true;
  let key = Symbol();
  currentHandlerStackKey = key;
  directiveHandlerStacks.set(key, []);

  let flushHandlers = () => {
    while (directiveHandlerStacks.get(key).length) directiveHandlerStacks.get(key).shift()();

    directiveHandlerStacks.delete(key);
  };

  let stopDeferring = () => {
    isDeferringHandlers = false;
    flushHandlers();
  };

  callback(flushHandlers);
  stopDeferring();
}

function getElementBoundUtilities(el) {
  let cleanups = [];

  let cleanup2 = callback => cleanups.push(callback);

  let [effect3, cleanupEffect] = elementBoundEffect(el);
  cleanups.push(cleanupEffect);
  let utilities = {
    Alpine: alpine_default,
    effect: effect3,
    cleanup: cleanup2,
    evaluateLater: evaluateLater.bind(evaluateLater, el),
    evaluate: evaluate.bind(evaluate, el)
  };

  let doCleanup = () => cleanups.forEach(i => i());

  return [utilities, doCleanup];
}

function getDirectiveHandler(el, directive2) {
  let noop = () => {};

  let handler3 = directiveHandlers[directive2.type] || noop;
  let [utilities, cleanup2] = getElementBoundUtilities(el);
  onAttributeRemoved(el, directive2.original, cleanup2);

  let fullHandler = () => {
    if (el._x_ignore || el._x_ignoreSelf) return;
    handler3.inline && handler3.inline(el, directive2, utilities);
    handler3 = handler3.bind(handler3, el, directive2, utilities);
    isDeferringHandlers ? directiveHandlerStacks.get(currentHandlerStackKey).push(handler3) : handler3();
  };

  fullHandler.runCleanups = cleanup2;
  return fullHandler;
}

var startingWith = (subject, replacement) => _ref9 => {
  let {
    name,
    value
  } = _ref9;
  if (name.startsWith(subject)) name = name.replace(subject, replacement);
  return {
    name,
    value
  };
};

var into = i => i;

function toTransformedAttributes() {
  let callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
  return _ref10 => {
    let {
      name,
      value
    } = _ref10;
    let {
      name: newName,
      value: newValue
    } = attributeTransformers.reduce((carry, transform) => {
      return transform(carry);
    }, {
      name,
      value
    });
    if (newName !== name) callback(newName, name);
    return {
      name: newName,
      value: newValue
    };
  };
}

var attributeTransformers = [];

function mapAttributes(callback) {
  attributeTransformers.push(callback);
}

function outNonAlpineAttributes(_ref11) {
  let {
    name
  } = _ref11;
  return alpineAttributeRegex().test(name);
}

var alpineAttributeRegex = () => new RegExp(`^${prefixAsString}([^:^.]+)\\b`);

function toParsedDirectives(transformedAttributeMap, originalAttributeOverride) {
  return _ref12 => {
    let {
      name,
      value
    } = _ref12;
    let typeMatch = name.match(alpineAttributeRegex());
    let valueMatch = name.match(/:([a-zA-Z0-9\-:]+)/);
    let modifiers = name.match(/\.[^.\]]+(?=[^\]]*$)/g) || [];
    let original = originalAttributeOverride || transformedAttributeMap[name] || name;
    return {
      type: typeMatch ? typeMatch[1] : null,
      value: valueMatch ? valueMatch[1] : null,
      modifiers: modifiers.map(i => i.replace(".", "")),
      expression: value,
      original
    };
  };
}

var DEFAULT = "DEFAULT";
var directiveOrder = ["ignore", "ref", "data", "id", "bind", "init", "for", "model", "modelable", "transition", "show", "if", DEFAULT, "teleport"];

function byPriority(a, b) {
  let typeA = directiveOrder.indexOf(a.type) === -1 ? DEFAULT : a.type;
  let typeB = directiveOrder.indexOf(b.type) === -1 ? DEFAULT : b.type;
  return directiveOrder.indexOf(typeA) - directiveOrder.indexOf(typeB);
} // packages/alpinejs/src/utils/dispatch.js


function dispatch(el, name) {
  let detail = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  el.dispatchEvent(new CustomEvent(name, {
    detail,
    bubbles: true,
    // Allows events to pass the shadow DOM barrier.
    composed: true,
    cancelable: true
  }));
} // packages/alpinejs/src/utils/walk.js


function walk(el, callback) {
  if (typeof ShadowRoot === "function" && el instanceof ShadowRoot) {
    Array.from(el.children).forEach(el2 => walk(el2, callback));
    return;
  }

  let skip = false;
  callback(el, () => skip = true);
  if (skip) return;
  let node = el.firstElementChild;

  while (node) {
    walk(node, callback);
    node = node.nextElementSibling;
  }
} // packages/alpinejs/src/utils/warn.js


function warn(message) {
  for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
    args[_key3 - 1] = arguments[_key3];
  }

  console.warn(`Alpine Warning: ${message}`, ...args);
} // packages/alpinejs/src/lifecycle.js


function start() {
  if (!document.body) warn("Unable to initialize. Trying to load Alpine before `<body>` is available. Did you forget to add `defer` in Alpine's `<script>` tag?");
  dispatch(document, "alpine:init");
  dispatch(document, "alpine:initializing");
  startObservingMutations();
  onElAdded(el => initTree(el, walk));
  onElRemoved(el => destroyTree(el));
  onAttributesAdded((el, attrs) => {
    directives(el, attrs).forEach(handle => handle());
  });

  let outNestedComponents = el => !closestRoot(el.parentElement, true);

  Array.from(document.querySelectorAll(allSelectors())).filter(outNestedComponents).forEach(el => {
    initTree(el);
  });
  dispatch(document, "alpine:initialized");
}

var rootSelectorCallbacks = [];
var initSelectorCallbacks = [];

function rootSelectors() {
  return rootSelectorCallbacks.map(fn => fn());
}

function allSelectors() {
  return rootSelectorCallbacks.concat(initSelectorCallbacks).map(fn => fn());
}

function addRootSelector(selectorCallback) {
  rootSelectorCallbacks.push(selectorCallback);
}

function addInitSelector(selectorCallback) {
  initSelectorCallbacks.push(selectorCallback);
}

function closestRoot(el) {
  let includeInitSelectors = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  return findClosest(el, element => {
    const selectors = includeInitSelectors ? allSelectors() : rootSelectors();
    if (selectors.some(selector => element.matches(selector))) return true;
  });
}

function findClosest(el, callback) {
  if (!el) return;
  if (callback(el)) return el;
  if (el._x_teleportBack) el = el._x_teleportBack;
  if (!el.parentElement) return;
  return findClosest(el.parentElement, callback);
}

function isRoot(el) {
  return rootSelectors().some(selector => el.matches(selector));
}

var initInterceptors2 = [];

function interceptInit(callback) {
  initInterceptors2.push(callback);
}

function initTree(el) {
  let walker = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : walk;
  let intercept = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : () => {};
  deferHandlingDirectives(() => {
    walker(el, (el2, skip) => {
      intercept(el2, skip);
      initInterceptors2.forEach(i => i(el2, skip));
      directives(el2, el2.attributes).forEach(handle => handle());
      el2._x_ignore && skip();
    });
  });
}

function destroyTree(root) {
  walk(root, el => cleanupAttributes(el));
} // packages/alpinejs/src/nextTick.js


var tickStack = [];
var isHolding = false;

function nextTick() {
  let callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
  queueMicrotask(() => {
    isHolding || setTimeout(() => {
      releaseNextTicks();
    });
  });
  return new Promise(res => {
    tickStack.push(() => {
      callback();
      res();
    });
  });
}

function releaseNextTicks() {
  isHolding = false;

  while (tickStack.length) tickStack.shift()();
}

function holdNextTicks() {
  isHolding = true;
} // packages/alpinejs/src/utils/classes.js


function setClasses(el, value) {
  if (Array.isArray(value)) {
    return setClassesFromString(el, value.join(" "));
  } else if (typeof value === "object" && value !== null) {
    return setClassesFromObject(el, value);
  } else if (typeof value === "function") {
    return setClasses(el, value());
  }

  return setClassesFromString(el, value);
}

function setClassesFromString(el, classString) {
  let missingClasses = classString2 => classString2.split(" ").filter(i => !el.classList.contains(i)).filter(Boolean);

  let addClassesAndReturnUndo = classes => {
    el.classList.add(...classes);
    return () => {
      el.classList.remove(...classes);
    };
  };

  classString = classString === true ? classString = "" : classString || "";
  return addClassesAndReturnUndo(missingClasses(classString));
}

function setClassesFromObject(el, classObject) {
  let split = classString => classString.split(" ").filter(Boolean);

  let forAdd = Object.entries(classObject).flatMap(_ref13 => {
    let [classString, bool] = _ref13;
    return bool ? split(classString) : false;
  }).filter(Boolean);
  let forRemove = Object.entries(classObject).flatMap(_ref14 => {
    let [classString, bool] = _ref14;
    return !bool ? split(classString) : false;
  }).filter(Boolean);
  let added = [];
  let removed = [];
  forRemove.forEach(i => {
    if (el.classList.contains(i)) {
      el.classList.remove(i);
      removed.push(i);
    }
  });
  forAdd.forEach(i => {
    if (!el.classList.contains(i)) {
      el.classList.add(i);
      added.push(i);
    }
  });
  return () => {
    removed.forEach(i => el.classList.add(i));
    added.forEach(i => el.classList.remove(i));
  };
} // packages/alpinejs/src/utils/styles.js


function setStyles(el, value) {
  if (typeof value === "object" && value !== null) {
    return setStylesFromObject(el, value);
  }

  return setStylesFromString(el, value);
}

function setStylesFromObject(el, value) {
  let previousStyles = {};
  Object.entries(value).forEach(_ref15 => {
    let [key, value2] = _ref15;
    previousStyles[key] = el.style[key];

    if (!key.startsWith("--")) {
      key = kebabCase(key);
    }

    el.style.setProperty(key, value2);
  });
  setTimeout(() => {
    if (el.style.length === 0) {
      el.removeAttribute("style");
    }
  });
  return () => {
    setStyles(el, previousStyles);
  };
}

function setStylesFromString(el, value) {
  let cache = el.getAttribute("style", value);
  el.setAttribute("style", value);
  return () => {
    el.setAttribute("style", cache || "");
  };
}

function kebabCase(subject) {
  return subject.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
} // packages/alpinejs/src/utils/once.js


function once(callback) {
  let fallback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
  let called = false;
  return function () {
    if (!called) {
      called = true;
      callback.apply(this, arguments);
    } else {
      fallback.apply(this, arguments);
    }
  };
} // packages/alpinejs/src/directives/x-transition.js


directive("transition", (el, _ref16, _ref17) => {
  let {
    value,
    modifiers,
    expression
  } = _ref16;
  let {
    evaluate: evaluate2
  } = _ref17;
  if (typeof expression === "function") expression = evaluate2(expression);

  if (!expression) {
    registerTransitionsFromHelper(el, modifiers, value);
  } else {
    registerTransitionsFromClassString(el, expression, value);
  }
});

function registerTransitionsFromClassString(el, classString, stage) {
  registerTransitionObject(el, setClasses, "");
  let directiveStorageMap = {
    "enter": classes => {
      el._x_transition.enter.during = classes;
    },
    "enter-start": classes => {
      el._x_transition.enter.start = classes;
    },
    "enter-end": classes => {
      el._x_transition.enter.end = classes;
    },
    "leave": classes => {
      el._x_transition.leave.during = classes;
    },
    "leave-start": classes => {
      el._x_transition.leave.start = classes;
    },
    "leave-end": classes => {
      el._x_transition.leave.end = classes;
    }
  };
  directiveStorageMap[stage](classString);
}

function registerTransitionsFromHelper(el, modifiers, stage) {
  registerTransitionObject(el, setStyles);
  let doesntSpecify = !modifiers.includes("in") && !modifiers.includes("out") && !stage;
  let transitioningIn = doesntSpecify || modifiers.includes("in") || ["enter"].includes(stage);
  let transitioningOut = doesntSpecify || modifiers.includes("out") || ["leave"].includes(stage);

  if (modifiers.includes("in") && !doesntSpecify) {
    modifiers = modifiers.filter((i, index) => index < modifiers.indexOf("out"));
  }

  if (modifiers.includes("out") && !doesntSpecify) {
    modifiers = modifiers.filter((i, index) => index > modifiers.indexOf("out"));
  }

  let wantsAll = !modifiers.includes("opacity") && !modifiers.includes("scale");
  let wantsOpacity = wantsAll || modifiers.includes("opacity");
  let wantsScale = wantsAll || modifiers.includes("scale");
  let opacityValue = wantsOpacity ? 0 : 1;
  let scaleValue = wantsScale ? modifierValue$1(modifiers, "scale", 95) / 100 : 1;
  let delay = modifierValue$1(modifiers, "delay", 0);
  let origin = modifierValue$1(modifiers, "origin", "center");
  let property = "opacity, transform";
  let durationIn = modifierValue$1(modifiers, "duration", 150) / 1e3;
  let durationOut = modifierValue$1(modifiers, "duration", 75) / 1e3;
  let easing = `cubic-bezier(0.4, 0.0, 0.2, 1)`;

  if (transitioningIn) {
    el._x_transition.enter.during = {
      transformOrigin: origin,
      transitionDelay: delay,
      transitionProperty: property,
      transitionDuration: `${durationIn}s`,
      transitionTimingFunction: easing
    };
    el._x_transition.enter.start = {
      opacity: opacityValue,
      transform: `scale(${scaleValue})`
    };
    el._x_transition.enter.end = {
      opacity: 1,
      transform: `scale(1)`
    };
  }

  if (transitioningOut) {
    el._x_transition.leave.during = {
      transformOrigin: origin,
      transitionDelay: delay,
      transitionProperty: property,
      transitionDuration: `${durationOut}s`,
      transitionTimingFunction: easing
    };
    el._x_transition.leave.start = {
      opacity: 1,
      transform: `scale(1)`
    };
    el._x_transition.leave.end = {
      opacity: opacityValue,
      transform: `scale(${scaleValue})`
    };
  }
}

function registerTransitionObject(el, setFunction) {
  let defaultValue = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  if (!el._x_transition) el._x_transition = {
    enter: {
      during: defaultValue,
      start: defaultValue,
      end: defaultValue
    },
    leave: {
      during: defaultValue,
      start: defaultValue,
      end: defaultValue
    },

    in() {
      let before = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
      let after = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
      transition(el, setFunction, {
        during: this.enter.during,
        start: this.enter.start,
        end: this.enter.end
      }, before, after);
    },

    out() {
      let before = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
      let after = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
      transition(el, setFunction, {
        during: this.leave.during,
        start: this.leave.start,
        end: this.leave.end
      }, before, after);
    }

  };
}

window.Element.prototype._x_toggleAndCascadeWithTransitions = function (el, value, show, hide) {
  const nextTick2 = document.visibilityState === "visible" ? requestAnimationFrame : setTimeout;

  let clickAwayCompatibleShow = () => nextTick2(show);

  if (value) {
    if (el._x_transition && (el._x_transition.enter || el._x_transition.leave)) {
      el._x_transition.enter && (Object.entries(el._x_transition.enter.during).length || Object.entries(el._x_transition.enter.start).length || Object.entries(el._x_transition.enter.end).length) ? el._x_transition.in(show) : clickAwayCompatibleShow();
    } else {
      el._x_transition ? el._x_transition.in(show) : clickAwayCompatibleShow();
    }

    return;
  }

  el._x_hidePromise = el._x_transition ? new Promise((resolve, reject) => {
    el._x_transition.out(() => {}, () => resolve(hide));

    el._x_transitioning.beforeCancel(() => reject({
      isFromCancelledTransition: true
    }));
  }) : Promise.resolve(hide);
  queueMicrotask(() => {
    let closest = closestHide(el);

    if (closest) {
      if (!closest._x_hideChildren) closest._x_hideChildren = [];

      closest._x_hideChildren.push(el);
    } else {
      nextTick2(() => {
        let hideAfterChildren = el2 => {
          let carry = Promise.all([el2._x_hidePromise, ...(el2._x_hideChildren || []).map(hideAfterChildren)]).then(_ref18 => {
            let [i] = _ref18;
            return i();
          });
          delete el2._x_hidePromise;
          delete el2._x_hideChildren;
          return carry;
        };

        hideAfterChildren(el).catch(e => {
          if (!e.isFromCancelledTransition) throw e;
        });
      });
    }
  });
};

function closestHide(el) {
  let parent = el.parentNode;
  if (!parent) return;
  return parent._x_hidePromise ? parent : closestHide(parent);
}

function transition(el, setFunction) {
  let {
    during,
    start: start2,
    end
  } = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  let before = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : () => {};
  let after = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : () => {};
  if (el._x_transitioning) el._x_transitioning.cancel();

  if (Object.keys(during).length === 0 && Object.keys(start2).length === 0 && Object.keys(end).length === 0) {
    before();
    after();
    return;
  }

  let undoStart, undoDuring, undoEnd;
  performTransition(el, {
    start() {
      undoStart = setFunction(el, start2);
    },

    during() {
      undoDuring = setFunction(el, during);
    },

    before,

    end() {
      undoStart();
      undoEnd = setFunction(el, end);
    },

    after,

    cleanup() {
      undoDuring();
      undoEnd();
    }

  });
}

function performTransition(el, stages) {
  let interrupted, reachedBefore, reachedEnd;
  let finish = once(() => {
    mutateDom(() => {
      interrupted = true;
      if (!reachedBefore) stages.before();

      if (!reachedEnd) {
        stages.end();
        releaseNextTicks();
      }

      stages.after();
      if (el.isConnected) stages.cleanup();
      delete el._x_transitioning;
    });
  });
  el._x_transitioning = {
    beforeCancels: [],

    beforeCancel(callback) {
      this.beforeCancels.push(callback);
    },

    cancel: once(function () {
      while (this.beforeCancels.length) {
        this.beforeCancels.shift()();
      }

      finish();
    }),
    finish
  };
  mutateDom(() => {
    stages.start();
    stages.during();
  });
  holdNextTicks();
  requestAnimationFrame(() => {
    if (interrupted) return;
    let duration = Number(getComputedStyle(el).transitionDuration.replace(/,.*/, "").replace("s", "")) * 1e3;
    let delay = Number(getComputedStyle(el).transitionDelay.replace(/,.*/, "").replace("s", "")) * 1e3;
    if (duration === 0) duration = Number(getComputedStyle(el).animationDuration.replace("s", "")) * 1e3;
    mutateDom(() => {
      stages.before();
    });
    reachedBefore = true;
    requestAnimationFrame(() => {
      if (interrupted) return;
      mutateDom(() => {
        stages.end();
      });
      releaseNextTicks();
      setTimeout(el._x_transitioning.finish, duration + delay);
      reachedEnd = true;
    });
  });
}

function modifierValue$1(modifiers, key, fallback) {
  if (modifiers.indexOf(key) === -1) return fallback;
  const rawValue = modifiers[modifiers.indexOf(key) + 1];
  if (!rawValue) return fallback;

  if (key === "scale") {
    if (isNaN(rawValue)) return fallback;
  }

  if (key === "duration") {
    let match = rawValue.match(/([0-9]+)ms/);
    if (match) return match[1];
  }

  if (key === "origin") {
    if (["top", "right", "left", "center", "bottom"].includes(modifiers[modifiers.indexOf(key) + 2])) {
      return [rawValue, modifiers[modifiers.indexOf(key) + 2]].join(" ");
    }
  }

  return rawValue;
} // packages/alpinejs/src/clone.js


var isCloning = false;

function skipDuringClone(callback) {
  let fallback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
  return function () {
    return isCloning ? fallback(...arguments) : callback(...arguments);
  };
}

function onlyDuringClone(callback) {
  return function () {
    return isCloning && callback(...arguments);
  };
}

function clone(oldEl, newEl) {
  if (!newEl._x_dataStack) newEl._x_dataStack = oldEl._x_dataStack;
  isCloning = true;
  dontRegisterReactiveSideEffects(() => {
    cloneTree(newEl);
  });
  isCloning = false;
}

function cloneTree(el) {
  let hasRunThroughFirstEl = false;

  let shallowWalker = (el2, callback) => {
    walk(el2, (el3, skip) => {
      if (hasRunThroughFirstEl && isRoot(el3)) return skip();
      hasRunThroughFirstEl = true;
      callback(el3, skip);
    });
  };

  initTree(el, shallowWalker);
}

function dontRegisterReactiveSideEffects(callback) {
  let cache = effect;
  overrideEffect((callback2, el) => {
    let storedEffect = cache(callback2);
    release(storedEffect);
    return () => {};
  });
  callback();
  overrideEffect(cache);
} // packages/alpinejs/src/utils/bind.js


function bind(el, name, value) {
  let modifiers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  if (!el._x_bindings) el._x_bindings = reactive({});
  el._x_bindings[name] = value;
  name = modifiers.includes("camel") ? camelCase(name) : name;

  switch (name) {
    case "value":
      bindInputValue(el, value);
      break;

    case "style":
      bindStyles(el, value);
      break;

    case "class":
      bindClasses(el, value);
      break;

    default:
      bindAttribute(el, name, value);
      break;
  }
}

function bindInputValue(el, value) {
  if (el.type === "radio") {
    if (el.attributes.value === void 0) {
      el.value = value;
    }

    if (window.fromModel) {
      el.checked = checkedAttrLooseCompare(el.value, value);
    }
  } else if (el.type === "checkbox") {
    if (Number.isInteger(value)) {
      el.value = value;
    } else if (!Number.isInteger(value) && !Array.isArray(value) && typeof value !== "boolean" && ![null, void 0].includes(value)) {
      el.value = String(value);
    } else {
      if (Array.isArray(value)) {
        el.checked = value.some(val => checkedAttrLooseCompare(val, el.value));
      } else {
        el.checked = !!value;
      }
    }
  } else if (el.tagName === "SELECT") {
    updateSelect(el, value);
  } else {
    if (el.value === value) return;
    el.value = value;
  }
}

function bindClasses(el, value) {
  if (el._x_undoAddedClasses) el._x_undoAddedClasses();
  el._x_undoAddedClasses = setClasses(el, value);
}

function bindStyles(el, value) {
  if (el._x_undoAddedStyles) el._x_undoAddedStyles();
  el._x_undoAddedStyles = setStyles(el, value);
}

function bindAttribute(el, name, value) {
  if ([null, void 0, false].includes(value) && attributeShouldntBePreservedIfFalsy(name)) {
    el.removeAttribute(name);
  } else {
    if (isBooleanAttr(name)) value = name;
    setIfChanged(el, name, value);
  }
}

function setIfChanged(el, attrName, value) {
  if (el.getAttribute(attrName) != value) {
    el.setAttribute(attrName, value);
  }
}

function updateSelect(el, value) {
  const arrayWrappedValue = [].concat(value).map(value2 => {
    return value2 + "";
  });
  Array.from(el.options).forEach(option => {
    option.selected = arrayWrappedValue.includes(option.value);
  });
}

function camelCase(subject) {
  return subject.toLowerCase().replace(/-(\w)/g, (match, char) => char.toUpperCase());
}

function checkedAttrLooseCompare(valueA, valueB) {
  return valueA == valueB;
}

function isBooleanAttr(attrName) {
  const booleanAttributes = ["disabled", "checked", "required", "readonly", "hidden", "open", "selected", "autofocus", "itemscope", "multiple", "novalidate", "allowfullscreen", "allowpaymentrequest", "formnovalidate", "autoplay", "controls", "loop", "muted", "playsinline", "default", "ismap", "reversed", "async", "defer", "nomodule"];
  return booleanAttributes.includes(attrName);
}

function attributeShouldntBePreservedIfFalsy(name) {
  return !["aria-pressed", "aria-checked", "aria-expanded", "aria-selected"].includes(name);
}

function getBinding(el, name, fallback) {
  if (el._x_bindings && el._x_bindings[name] !== void 0) return el._x_bindings[name];
  let attr = el.getAttribute(name);
  if (attr === null) return typeof fallback === "function" ? fallback() : fallback;
  if (attr === "") return true;

  if (isBooleanAttr(name)) {
    return !![name, "true"].includes(attr);
  }

  return attr;
} // packages/alpinejs/src/utils/debounce.js


function debounce(func, wait) {
  var timeout;
  return function () {
    var context = this,
        args = arguments;

    var later = function () {
      timeout = null;
      func.apply(context, args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
} // packages/alpinejs/src/utils/throttle.js


function throttle(func, limit) {
  let inThrottle;
  return function () {
    let context = this,
        args = arguments;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
} // packages/alpinejs/src/plugin.js


function plugin(callback) {
  callback(alpine_default);
} // packages/alpinejs/src/store.js


var stores = {};
var isReactive = false;

function store(name, value) {
  if (!isReactive) {
    stores = reactive(stores);
    isReactive = true;
  }

  if (value === void 0) {
    return stores[name];
  }

  stores[name] = value;

  if (typeof value === "object" && value !== null && value.hasOwnProperty("init") && typeof value.init === "function") {
    stores[name].init();
  }

  initInterceptors(stores[name]);
}

function getStores() {
  return stores;
} // packages/alpinejs/src/binds.js


var binds = {};

function bind2(name, bindings) {
  let getBindings = typeof bindings !== "function" ? () => bindings : bindings;

  if (name instanceof Element) {
    applyBindingsObject(name, getBindings());
  } else {
    binds[name] = getBindings;
  }
}

function injectBindingProviders(obj) {
  Object.entries(binds).forEach(_ref19 => {
    let [name, callback] = _ref19;
    Object.defineProperty(obj, name, {
      get() {
        return function () {
          return callback(...arguments);
        };
      }

    });
  });
  return obj;
}

function applyBindingsObject(el, obj, original) {
  let cleanupRunners = [];

  while (cleanupRunners.length) cleanupRunners.pop()();

  let attributes = Object.entries(obj).map(_ref20 => {
    let [name, value] = _ref20;
    return {
      name,
      value
    };
  });
  let staticAttributes = attributesOnly(attributes);
  attributes = attributes.map(attribute => {
    if (staticAttributes.find(attr => attr.name === attribute.name)) {
      return {
        name: `x-bind:${attribute.name}`,
        value: `"${attribute.value}"`
      };
    }

    return attribute;
  });
  directives(el, attributes, original).map(handle => {
    cleanupRunners.push(handle.runCleanups);
    handle();
  });
} // packages/alpinejs/src/datas.js


var datas = {};

function data(name, callback) {
  datas[name] = callback;
}

function injectDataProviders(obj, context) {
  Object.entries(datas).forEach(_ref21 => {
    let [name, callback] = _ref21;
    Object.defineProperty(obj, name, {
      get() {
        return function () {
          return callback.bind(context)(...arguments);
        };
      },

      enumerable: false
    });
  });
  return obj;
} // packages/alpinejs/src/alpine.js


var Alpine = {
  get reactive() {
    return reactive;
  },

  get release() {
    return release;
  },

  get effect() {
    return effect;
  },

  get raw() {
    return raw;
  },

  version: "3.12.0",
  flushAndStopDeferringMutations,
  dontAutoEvaluateFunctions,
  disableEffectScheduling,
  startObservingMutations,
  stopObservingMutations,
  setReactivityEngine,
  closestDataStack,
  skipDuringClone,
  onlyDuringClone,
  addRootSelector,
  addInitSelector,
  addScopeToNode,
  deferMutations,
  mapAttributes,
  evaluateLater,
  interceptInit,
  setEvaluator,
  mergeProxies,
  findClosest,
  closestRoot,
  destroyTree,
  interceptor,
  // INTERNAL: not public API and is subject to change without major release.
  transition,
  // INTERNAL
  setStyles,
  // INTERNAL
  mutateDom,
  directive,
  throttle,
  debounce,
  evaluate,
  initTree,
  nextTick,
  prefixed: prefix,
  prefix: setPrefix,
  plugin,
  magic,
  store,
  start,
  clone,
  bound: getBinding,
  $data: scope,
  walk,
  data,
  bind: bind2
};
var alpine_default = Alpine; // node_modules/@vue/shared/dist/shared.esm-bundler.js

function makeMap(str, expectsLowerCase) {
  const map = /* @__PURE__ */Object.create(null);
  const list = str.split(",");

  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true;
  }

  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val];
}

var EMPTY_OBJ = Object.freeze({});
Object.freeze([]);
var extend = Object.assign;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var hasOwn = (val, key) => hasOwnProperty.call(val, key);

var isArray = Array.isArray;

var isMap = val => toTypeString(val) === "[object Map]";

var isString = val => typeof val === "string";

var isSymbol = val => typeof val === "symbol";

var isObject = val => val !== null && typeof val === "object";

var objectToString = Object.prototype.toString;

var toTypeString = value => objectToString.call(value);

var toRawType = value => {
  return toTypeString(value).slice(8, -1);
};

var isIntegerKey = key => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;

var cacheStringFunction = fn => {
  const cache = /* @__PURE__ */Object.create(null);
  return str => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
};

var capitalize = cacheStringFunction(str => str.charAt(0).toUpperCase() + str.slice(1));

var hasChanged = (value, oldValue) => value !== oldValue && (value === value || oldValue === oldValue); // node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js


var targetMap = /* @__PURE__ */new WeakMap();
var effectStack = [];
var activeEffect;
var ITERATE_KEY = Symbol("iterate");
var MAP_KEY_ITERATE_KEY = Symbol("Map key iterate");

function isEffect(fn) {
  return fn && fn._isEffect === true;
}

function effect2(fn) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : EMPTY_OBJ;

  if (isEffect(fn)) {
    fn = fn.raw;
  }

  const effect3 = createReactiveEffect(fn, options);

  if (!options.lazy) {
    effect3();
  }

  return effect3;
}

function stop(effect3) {
  if (effect3.active) {
    cleanup(effect3);

    if (effect3.options.onStop) {
      effect3.options.onStop();
    }

    effect3.active = false;
  }
}

var uid = 0;

function createReactiveEffect(fn, options) {
  const effect3 = function reactiveEffect() {
    if (!effect3.active) {
      return fn();
    }

    if (!effectStack.includes(effect3)) {
      cleanup(effect3);

      try {
        enableTracking();
        effectStack.push(effect3);
        activeEffect = effect3;
        return fn();
      } finally {
        effectStack.pop();
        resetTracking();
        activeEffect = effectStack[effectStack.length - 1];
      }
    }
  };

  effect3.id = uid++;
  effect3.allowRecurse = !!options.allowRecurse;
  effect3._isEffect = true;
  effect3.active = true;
  effect3.raw = fn;
  effect3.deps = [];
  effect3.options = options;
  return effect3;
}

function cleanup(effect3) {
  const {
    deps
  } = effect3;

  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect3);
    }

    deps.length = 0;
  }
}

var shouldTrack = true;
var trackStack = [];

function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}

function enableTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = true;
}

function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}

function track(target, type, key) {
  if (!shouldTrack || activeEffect === void 0) {
    return;
  }

  let depsMap = targetMap.get(target);

  if (!depsMap) {
    targetMap.set(target, depsMap = /* @__PURE__ */new Map());
  }

  let dep = depsMap.get(key);

  if (!dep) {
    depsMap.set(key, dep = /* @__PURE__ */new Set());
  }

  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);

    if (activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      });
    }
  }
}

function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);

  if (!depsMap) {
    return;
  }

  const effects = /* @__PURE__ */new Set();

  const add2 = effectsToAdd => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect3 => {
        if (effect3 !== activeEffect || effect3.allowRecurse) {
          effects.add(effect3);
        }
      });
    }
  };

  if (type === "clear") {
    depsMap.forEach(add2);
  } else if (key === "length" && isArray(target)) {
    depsMap.forEach((dep, key2) => {
      if (key2 === "length" || key2 >= newValue) {
        add2(dep);
      }
    });
  } else {
    if (key !== void 0) {
      add2(depsMap.get(key));
    }

    switch (type) {
      case "add":
        if (!isArray(target)) {
          add2(depsMap.get(ITERATE_KEY));

          if (isMap(target)) {
            add2(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          add2(depsMap.get("length"));
        }

        break;

      case "delete":
        if (!isArray(target)) {
          add2(depsMap.get(ITERATE_KEY));

          if (isMap(target)) {
            add2(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }

        break;

      case "set":
        if (isMap(target)) {
          add2(depsMap.get(ITERATE_KEY));
        }

        break;
    }
  }

  const run = effect3 => {
    if (effect3.options.onTrigger) {
      effect3.options.onTrigger({
        effect: effect3,
        target,
        key,
        type,
        newValue,
        oldValue,
        oldTarget
      });
    }

    if (effect3.options.scheduler) {
      effect3.options.scheduler(effect3);
    } else {
      effect3();
    }
  };

  effects.forEach(run);
}

var isNonTrackableKeys = /* @__PURE__ */makeMap(`__proto__,__v_isRef,__isVue`);
var builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol).map(key => Symbol[key]).filter(isSymbol));
var get2 = /* @__PURE__ */createGetter();
var shallowGet = /* @__PURE__ */createGetter(false, true);
var readonlyGet = /* @__PURE__ */createGetter(true);
var shallowReadonlyGet = /* @__PURE__ */createGetter(true, true);
var arrayInstrumentations = {};
["includes", "indexOf", "lastIndexOf"].forEach(key => {
  const method = Array.prototype[key];

  arrayInstrumentations[key] = function () {
    const arr = toRaw(this);

    for (let i = 0, l = this.length; i < l; i++) {
      track(arr, "get", i + "");
    }

    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    const res = method.apply(arr, args);

    if (res === -1 || res === false) {
      return method.apply(arr, args.map(toRaw));
    } else {
      return res;
    }
  };
});
["push", "pop", "shift", "unshift", "splice"].forEach(key => {
  const method = Array.prototype[key];

  arrayInstrumentations[key] = function () {
    pauseTracking();

    for (var _len5 = arguments.length, args = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
      args[_key5] = arguments[_key5];
    }

    const res = method.apply(this, args);
    resetTracking();
    return res;
  };
});

function createGetter() {
  let isReadonly = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  let shallow = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  return function get3(target, key, receiver) {
    if (key === "__v_isReactive") {
      return !isReadonly;
    } else if (key === "__v_isReadonly") {
      return isReadonly;
    } else if (key === "__v_raw" && receiver === (isReadonly ? shallow ? shallowReadonlyMap : readonlyMap : shallow ? shallowReactiveMap : reactiveMap).get(target)) {
      return target;
    }

    const targetIsArray = isArray(target);

    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }

    const res = Reflect.get(target, key, receiver);

    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }

    if (!isReadonly) {
      track(target, "get", key);
    }

    if (shallow) {
      return res;
    }

    if (isRef(res)) {
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
      return shouldUnwrap ? res.value : res;
    }

    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive2(res);
    }

    return res;
  };
}

var set2 = /* @__PURE__ */createSetter();
var shallowSet = /* @__PURE__ */createSetter(true);

function createSetter() {
  let shallow = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  return function set3(target, key, value, receiver) {
    let oldValue = target[key];

    if (!shallow) {
      value = toRaw(value);
      oldValue = toRaw(oldValue);

      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      }
    }

    const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
    const result = Reflect.set(target, key, value, receiver);

    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, "add", key, value);
      } else if (hasChanged(value, oldValue)) {
        trigger(target, "set", key, value, oldValue);
      }
    }

    return result;
  };
}

function deleteProperty(target, key) {
  const hadKey = hasOwn(target, key);
  const oldValue = target[key];
  const result = Reflect.deleteProperty(target, key);

  if (result && hadKey) {
    trigger(target, "delete", key, void 0, oldValue);
  }

  return result;
}

function has(target, key) {
  const result = Reflect.has(target, key);

  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, "has", key);
  }

  return result;
}

function ownKeys$1(target) {
  track(target, "iterate", isArray(target) ? "length" : ITERATE_KEY);
  return Reflect.ownKeys(target);
}

var mutableHandlers = {
  get: get2,
  set: set2,
  deleteProperty,
  has,
  ownKeys: ownKeys$1
};
var readonlyHandlers = {
  get: readonlyGet,

  set(target, key) {
    {
      console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
    }
    return true;
  },

  deleteProperty(target, key) {
    {
      console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
    }
    return true;
  }

};
extend({}, mutableHandlers, {
  get: shallowGet,
  set: shallowSet
});
extend({}, readonlyHandlers, {
  get: shallowReadonlyGet
});

var toReactive = value => isObject(value) ? reactive2(value) : value;

var toReadonly = value => isObject(value) ? readonly(value) : value;

var toShallow = value => value;

var getProto = v => Reflect.getPrototypeOf(v);

function get$1(target, key) {
  let isReadonly = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  let isShallow = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  target = target["__v_raw"
  /* RAW */
  ];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);

  if (key !== rawKey) {
    !isReadonly && track(rawTarget, "get", key);
  }

  !isReadonly && track(rawTarget, "get", rawKey);
  const {
    has: has2
  } = getProto(rawTarget);
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;

  if (has2.call(rawTarget, key)) {
    return wrap(target.get(key));
  } else if (has2.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey));
  } else if (target !== rawTarget) {
    target.get(key);
  }
}

function has$1(key) {
  let isReadonly = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  const target = this["__v_raw"
  /* RAW */
  ];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);

  if (key !== rawKey) {
    !isReadonly && track(rawTarget, "has", key);
  }

  !isReadonly && track(rawTarget, "has", rawKey);
  return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
}

function size(target) {
  let isReadonly = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  target = target["__v_raw"
  /* RAW */
  ];
  !isReadonly && track(toRaw(target), "iterate", ITERATE_KEY);
  return Reflect.get(target, "size", target);
}

function add(value) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target);
  const hadKey = proto.has.call(target, value);

  if (!hadKey) {
    target.add(value);
    trigger(target, "add", value, value);
  }

  return this;
}

function set$1(key, value) {
  value = toRaw(value);
  const target = toRaw(this);
  const {
    has: has2,
    get: get3
  } = getProto(target);
  let hadKey = has2.call(target, key);

  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  } else {
    checkIdentityKeys(target, has2, key);
  }

  const oldValue = get3.call(target, key);
  target.set(key, value);

  if (!hadKey) {
    trigger(target, "add", key, value);
  } else if (hasChanged(value, oldValue)) {
    trigger(target, "set", key, value, oldValue);
  }

  return this;
}

function deleteEntry(key) {
  const target = toRaw(this);
  const {
    has: has2,
    get: get3
  } = getProto(target);
  let hadKey = has2.call(target, key);

  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  } else {
    checkIdentityKeys(target, has2, key);
  }

  const oldValue = get3 ? get3.call(target, key) : void 0;
  const result = target.delete(key);

  if (hadKey) {
    trigger(target, "delete", key, void 0, oldValue);
  }

  return result;
}

function clear() {
  const target = toRaw(this);
  const hadItems = target.size !== 0;
  const oldTarget = isMap(target) ? new Map(target) : new Set(target);
  const result = target.clear();

  if (hadItems) {
    trigger(target, "clear", void 0, void 0, oldTarget);
  }

  return result;
}

function createForEach(isReadonly, isShallow) {
  return function forEach(callback, thisArg) {
    const observed = this;
    const target = observed["__v_raw"
    /* RAW */
    ];
    const rawTarget = toRaw(target);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly && track(rawTarget, "iterate", ITERATE_KEY);
    return target.forEach((value, key) => {
      return callback.call(thisArg, wrap(value), wrap(key), observed);
    });
  };
}

function createIterableMethod(method, isReadonly, isShallow) {
  return function () {
    const target = this["__v_raw"
    /* RAW */
    ];
    const rawTarget = toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...arguments);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly && track(rawTarget, "iterate", isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
    return {
      // iterator protocol
      next() {
        const {
          value,
          done
        } = innerIterator.next();
        return done ? {
          value,
          done
        } : {
          value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
          done
        };
      },

      // iterable protocol
      [Symbol.iterator]() {
        return this;
      }

    };
  };
}

function createReadonlyMethod(type) {
  return function () {
    {
      const key = (arguments.length <= 0 ? undefined : arguments[0]) ? `on key "${arguments.length <= 0 ? undefined : arguments[0]}" ` : ``;
      console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
    }
    return type === "delete" ? false : this;
  };
}

var mutableInstrumentations = {
  get(key) {
    return get$1(this, key);
  },

  get size() {
    return size(this);
  },

  has: has$1,
  add,
  set: set$1,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, false)
};
var shallowInstrumentations = {
  get(key) {
    return get$1(this, key, false, true);
  },

  get size() {
    return size(this);
  },

  has: has$1,
  add,
  set: set$1,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, true)
};
var readonlyInstrumentations = {
  get(key) {
    return get$1(this, key, true);
  },

  get size() {
    return size(this, true);
  },

  has(key) {
    return has$1.call(this, key, true);
  },

  add: createReadonlyMethod("add"
  /* ADD */
  ),
  set: createReadonlyMethod("set"
  /* SET */
  ),
  delete: createReadonlyMethod("delete"
  /* DELETE */
  ),
  clear: createReadonlyMethod("clear"
  /* CLEAR */
  ),
  forEach: createForEach(true, false)
};
var shallowReadonlyInstrumentations = {
  get(key) {
    return get$1(this, key, true, true);
  },

  get size() {
    return size(this, true);
  },

  has(key) {
    return has$1.call(this, key, true);
  },

  add: createReadonlyMethod("add"
  /* ADD */
  ),
  set: createReadonlyMethod("set"
  /* SET */
  ),
  delete: createReadonlyMethod("delete"
  /* DELETE */
  ),
  clear: createReadonlyMethod("clear"
  /* CLEAR */
  ),
  forEach: createForEach(true, true)
};
var iteratorMethods = ["keys", "values", "entries", Symbol.iterator];
iteratorMethods.forEach(method => {
  mutableInstrumentations[method] = createIterableMethod(method, false, false);
  readonlyInstrumentations[method] = createIterableMethod(method, true, false);
  shallowInstrumentations[method] = createIterableMethod(method, false, true);
  shallowReadonlyInstrumentations[method] = createIterableMethod(method, true, true);
});

function createInstrumentationGetter(isReadonly, shallow) {
  const instrumentations = shallow ? isReadonly ? shallowReadonlyInstrumentations : shallowInstrumentations : isReadonly ? readonlyInstrumentations : mutableInstrumentations;
  return (target, key, receiver) => {
    if (key === "__v_isReactive") {
      return !isReadonly;
    } else if (key === "__v_isReadonly") {
      return isReadonly;
    } else if (key === "__v_raw") {
      return target;
    }

    return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
  };
}

var mutableCollectionHandlers = {
  get: createInstrumentationGetter(false, false)
};
var readonlyCollectionHandlers = {
  get: createInstrumentationGetter(true, false)
};

function checkIdentityKeys(target, has2, key) {
  const rawKey = toRaw(key);

  if (rawKey !== key && has2.call(target, rawKey)) {
    const type = toRawType(target);
    console.warn(`Reactive ${type} contains both the raw and reactive versions of the same object${type === `Map` ? ` as keys` : ``}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`);
  }
}

var reactiveMap = /* @__PURE__ */new WeakMap();
var shallowReactiveMap = /* @__PURE__ */new WeakMap();
var readonlyMap = /* @__PURE__ */new WeakMap();
var shallowReadonlyMap = /* @__PURE__ */new WeakMap();

function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1;

    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;

    default:
      return 0;
  }
}

function getTargetType(value) {
  return value["__v_skip"
  /* SKIP */
  ] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
}

function reactive2(target) {
  if (target && target["__v_isReadonly"
  /* IS_READONLY */
  ]) {
    return target;
  }

  return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
}

function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
}

function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject(target)) {
    {
      console.warn(`value cannot be made reactive: ${String(target)}`);
    }
    return target;
  }

  if (target["__v_raw"
  /* RAW */
  ] && !(isReadonly && target["__v_isReactive"
  /* IS_REACTIVE */
  ])) {
    return target;
  }

  const existingProxy = proxyMap.get(target);

  if (existingProxy) {
    return existingProxy;
  }

  const targetType = getTargetType(target);

  if (targetType === 0) {
    return target;
  }

  const proxy = new Proxy(target, targetType === 2 ? collectionHandlers : baseHandlers);
  proxyMap.set(target, proxy);
  return proxy;
}

function toRaw(observed) {
  return observed && toRaw(observed["__v_raw"
  /* RAW */
  ]) || observed;
}

function isRef(r) {
  return Boolean(r && r.__v_isRef === true);
} // packages/alpinejs/src/magics/$nextTick.js


magic("nextTick", () => nextTick); // packages/alpinejs/src/magics/$dispatch.js

magic("dispatch", el => dispatch.bind(dispatch, el)); // packages/alpinejs/src/magics/$watch.js

magic("watch", (el, _ref22) => {
  let {
    evaluateLater: evaluateLater2,
    effect: effect3
  } = _ref22;
  return (key, callback) => {
    let evaluate2 = evaluateLater2(key);
    let firstTime = true;
    let oldValue;
    let effectReference = effect3(() => evaluate2(value => {
      JSON.stringify(value);

      if (!firstTime) {
        queueMicrotask(() => {
          callback(value, oldValue);
          oldValue = value;
        });
      } else {
        oldValue = value;
      }

      firstTime = false;
    }));

    el._x_effects.delete(effectReference);
  };
}); // packages/alpinejs/src/magics/$store.js

magic("store", getStores); // packages/alpinejs/src/magics/$data.js

magic("data", el => scope(el)); // packages/alpinejs/src/magics/$root.js

magic("root", el => closestRoot(el)); // packages/alpinejs/src/magics/$refs.js

magic("refs", el => {
  if (el._x_refs_proxy) return el._x_refs_proxy;
  el._x_refs_proxy = mergeProxies(getArrayOfRefObject(el));
  return el._x_refs_proxy;
});

function getArrayOfRefObject(el) {
  let refObjects = [];
  let currentEl = el;

  while (currentEl) {
    if (currentEl._x_refs) refObjects.push(currentEl._x_refs);
    currentEl = currentEl.parentNode;
  }

  return refObjects;
} // packages/alpinejs/src/ids.js


var globalIdMemo = {};

function findAndIncrementId(name) {
  if (!globalIdMemo[name]) globalIdMemo[name] = 0;
  return ++globalIdMemo[name];
}

function closestIdRoot(el, name) {
  return findClosest(el, element => {
    if (element._x_ids && element._x_ids[name]) return true;
  });
}

function setIdRoot(el, name) {
  if (!el._x_ids) el._x_ids = {};
  if (!el._x_ids[name]) el._x_ids[name] = findAndIncrementId(name);
} // packages/alpinejs/src/magics/$id.js


magic("id", el => function (name) {
  let key = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  let root = closestIdRoot(el, name);
  let id = root ? root._x_ids[name] : findAndIncrementId(name);
  return key ? `${name}-${id}-${key}` : `${name}-${id}`;
}); // packages/alpinejs/src/magics/$el.js

magic("el", el => el); // packages/alpinejs/src/magics/index.js

warnMissingPluginMagic("Focus", "focus", "focus");
warnMissingPluginMagic("Persist", "persist", "persist");

function warnMissingPluginMagic(name, magicName, slug) {
  magic(magicName, el => warn(`You can't use [$${directiveName}] without first installing the "${name}" plugin here: https://alpinejs.dev/plugins/${slug}`, el));
} // packages/alpinejs/src/entangle.js


function entangle(_ref23, _ref24) {
  let {
    get: outerGet,
    set: outerSet
  } = _ref23;
  let {
    get: innerGet,
    set: innerSet
  } = _ref24;
  let firstRun = true;
  let outerHash, outerHashLatest;
  let reference = effect(() => {
    let outer, inner;

    if (firstRun) {
      outer = outerGet();
      innerSet(outer);
      inner = innerGet();
      firstRun = false;
    } else {
      outer = outerGet();
      inner = innerGet();
      outerHashLatest = JSON.stringify(outer);
      JSON.stringify(inner);

      if (outerHashLatest !== outerHash) {
        inner = innerGet();
        innerSet(outer);
        inner = outer;
      } else {
        outerSet(inner);
        outer = inner;
      }
    }

    outerHash = JSON.stringify(outer);
    JSON.stringify(inner);
  });
  return () => {
    release(reference);
  };
} // packages/alpinejs/src/directives/x-modelable.js


directive("modelable", (el, _ref25, _ref26) => {
  let {
    expression
  } = _ref25;
  let {
    effect: effect3,
    evaluateLater: evaluateLater2,
    cleanup: cleanup2
  } = _ref26;
  let func = evaluateLater2(expression);

  let innerGet = () => {
    let result;
    func(i => result = i);
    return result;
  };

  let evaluateInnerSet = evaluateLater2(`${expression} = __placeholder`);

  let innerSet = val => evaluateInnerSet(() => {}, {
    scope: {
      "__placeholder": val
    }
  });

  let initialValue = innerGet();
  innerSet(initialValue);
  queueMicrotask(() => {
    if (!el._x_model) return;

    el._x_removeModelListeners["default"]();

    let outerGet = el._x_model.get;
    let outerSet = el._x_model.set;
    let releaseEntanglement = entangle({
      get() {
        return outerGet();
      },

      set(value) {
        outerSet(value);
      }

    }, {
      get() {
        return innerGet();
      },

      set(value) {
        innerSet(value);
      }

    });
    cleanup2(releaseEntanglement);
  });
}); // packages/alpinejs/src/directives/x-teleport.js

var teleportContainerDuringClone = document.createElement("div");
directive("teleport", (el, _ref27, _ref28) => {
  let {
    modifiers,
    expression
  } = _ref27;
  let {
    cleanup: cleanup2
  } = _ref28;
  if (el.tagName.toLowerCase() !== "template") warn("x-teleport can only be used on a <template> tag", el);
  let target = skipDuringClone(() => {
    return document.querySelector(expression);
  }, () => {
    return teleportContainerDuringClone;
  })();
  if (!target) warn(`Cannot find x-teleport element for selector: "${expression}"`);
  let clone2 = el.content.cloneNode(true).firstElementChild;
  el._x_teleport = clone2;
  clone2._x_teleportBack = el;

  if (el._x_forwardEvents) {
    el._x_forwardEvents.forEach(eventName => {
      clone2.addEventListener(eventName, e => {
        e.stopPropagation();
        el.dispatchEvent(new e.constructor(e.type, e));
      });
    });
  }

  addScopeToNode(clone2, {}, el);
  mutateDom(() => {
    if (modifiers.includes("prepend")) {
      target.parentNode.insertBefore(clone2, target);
    } else if (modifiers.includes("append")) {
      target.parentNode.insertBefore(clone2, target.nextSibling);
    } else {
      target.appendChild(clone2);
    }

    initTree(clone2);
    clone2._x_ignore = true;
  });
  cleanup2(() => clone2.remove());
}); // packages/alpinejs/src/directives/x-ignore.js

var handler = () => {};

handler.inline = (el, _ref29, _ref30) => {
  let {
    modifiers
  } = _ref29;
  let {
    cleanup: cleanup2
  } = _ref30;
  modifiers.includes("self") ? el._x_ignoreSelf = true : el._x_ignore = true;
  cleanup2(() => {
    modifiers.includes("self") ? delete el._x_ignoreSelf : delete el._x_ignore;
  });
};

directive("ignore", handler); // packages/alpinejs/src/directives/x-effect.js

directive("effect", (el, _ref31, _ref32) => {
  let {
    expression
  } = _ref31;
  let {
    effect: effect3
  } = _ref32;
  return effect3(evaluateLater(el, expression));
}); // packages/alpinejs/src/utils/on.js

function on(el, event, modifiers, callback) {
  let listenerTarget = el;

  let handler3 = e => callback(e);

  let options = {};

  let wrapHandler = (callback2, wrapper) => e => wrapper(callback2, e);

  if (modifiers.includes("dot")) event = dotSyntax(event);
  if (modifiers.includes("camel")) event = camelCase2(event);
  if (modifiers.includes("passive")) options.passive = true;
  if (modifiers.includes("capture")) options.capture = true;
  if (modifiers.includes("window")) listenerTarget = window;
  if (modifiers.includes("document")) listenerTarget = document;
  if (modifiers.includes("prevent")) handler3 = wrapHandler(handler3, (next, e) => {
    e.preventDefault();
    next(e);
  });
  if (modifiers.includes("stop")) handler3 = wrapHandler(handler3, (next, e) => {
    e.stopPropagation();
    next(e);
  });
  if (modifiers.includes("self")) handler3 = wrapHandler(handler3, (next, e) => {
    e.target === el && next(e);
  });

  if (modifiers.includes("away") || modifiers.includes("outside")) {
    listenerTarget = document;
    handler3 = wrapHandler(handler3, (next, e) => {
      if (el.contains(e.target)) return;
      if (e.target.isConnected === false) return;
      if (el.offsetWidth < 1 && el.offsetHeight < 1) return;
      if (el._x_isShown === false) return;
      next(e);
    });
  }

  if (modifiers.includes("once")) {
    handler3 = wrapHandler(handler3, (next, e) => {
      next(e);
      listenerTarget.removeEventListener(event, handler3, options);
    });
  }

  handler3 = wrapHandler(handler3, (next, e) => {
    if (isKeyEvent(event)) {
      if (isListeningForASpecificKeyThatHasntBeenPressed(e, modifiers)) {
        return;
      }
    }

    next(e);
  });

  if (modifiers.includes("debounce")) {
    let nextModifier = modifiers[modifiers.indexOf("debounce") + 1] || "invalid-wait";
    let wait = isNumeric(nextModifier.split("ms")[0]) ? Number(nextModifier.split("ms")[0]) : 250;
    handler3 = debounce(handler3, wait);
  }

  if (modifiers.includes("throttle")) {
    let nextModifier = modifiers[modifiers.indexOf("throttle") + 1] || "invalid-wait";
    let wait = isNumeric(nextModifier.split("ms")[0]) ? Number(nextModifier.split("ms")[0]) : 250;
    handler3 = throttle(handler3, wait);
  }

  listenerTarget.addEventListener(event, handler3, options);
  return () => {
    listenerTarget.removeEventListener(event, handler3, options);
  };
}

function dotSyntax(subject) {
  return subject.replace(/-/g, ".");
}

function camelCase2(subject) {
  return subject.toLowerCase().replace(/-(\w)/g, (match, char) => char.toUpperCase());
}

function isNumeric(subject) {
  return !Array.isArray(subject) && !isNaN(subject);
}

function kebabCase2(subject) {
  if ([" ", "_"].includes(subject)) return subject;
  return subject.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[_\s]/, "-").toLowerCase();
}

function isKeyEvent(event) {
  return ["keydown", "keyup"].includes(event);
}

function isListeningForASpecificKeyThatHasntBeenPressed(e, modifiers) {
  let keyModifiers = modifiers.filter(i => {
    return !["window", "document", "prevent", "stop", "once", "capture"].includes(i);
  });

  if (keyModifiers.includes("debounce")) {
    let debounceIndex = keyModifiers.indexOf("debounce");
    keyModifiers.splice(debounceIndex, isNumeric((keyModifiers[debounceIndex + 1] || "invalid-wait").split("ms")[0]) ? 2 : 1);
  }

  if (keyModifiers.includes("throttle")) {
    let debounceIndex = keyModifiers.indexOf("throttle");
    keyModifiers.splice(debounceIndex, isNumeric((keyModifiers[debounceIndex + 1] || "invalid-wait").split("ms")[0]) ? 2 : 1);
  }

  if (keyModifiers.length === 0) return false;
  if (keyModifiers.length === 1 && keyToModifiers(e.key).includes(keyModifiers[0])) return false;
  const systemKeyModifiers = ["ctrl", "shift", "alt", "meta", "cmd", "super"];
  const selectedSystemKeyModifiers = systemKeyModifiers.filter(modifier => keyModifiers.includes(modifier));
  keyModifiers = keyModifiers.filter(i => !selectedSystemKeyModifiers.includes(i));

  if (selectedSystemKeyModifiers.length > 0) {
    const activelyPressedKeyModifiers = selectedSystemKeyModifiers.filter(modifier => {
      if (modifier === "cmd" || modifier === "super") modifier = "meta";
      return e[`${modifier}Key`];
    });

    if (activelyPressedKeyModifiers.length === selectedSystemKeyModifiers.length) {
      if (keyToModifiers(e.key).includes(keyModifiers[0])) return false;
    }
  }

  return true;
}

function keyToModifiers(key) {
  if (!key) return [];
  key = kebabCase2(key);
  let modifierToKeyMap = {
    "ctrl": "control",
    "slash": "/",
    "space": " ",
    "spacebar": " ",
    "cmd": "meta",
    "esc": "escape",
    "up": "arrow-up",
    "down": "arrow-down",
    "left": "arrow-left",
    "right": "arrow-right",
    "period": ".",
    "equal": "=",
    "minus": "-",
    "underscore": "_"
  };
  modifierToKeyMap[key] = key;
  return Object.keys(modifierToKeyMap).map(modifier => {
    if (modifierToKeyMap[modifier] === key) return modifier;
  }).filter(modifier => modifier);
} // packages/alpinejs/src/directives/x-model.js


directive("model", (el, _ref33, _ref34) => {
  let {
    modifiers,
    expression
  } = _ref33;
  let {
    effect: effect3,
    cleanup: cleanup2
  } = _ref34;
  let scopeTarget = el;

  if (modifiers.includes("parent")) {
    scopeTarget = el.parentNode;
  }

  let evaluateGet = evaluateLater(scopeTarget, expression);
  let evaluateSet;

  if (typeof expression === "string") {
    evaluateSet = evaluateLater(scopeTarget, `${expression} = __placeholder`);
  } else if (typeof expression === "function" && typeof expression() === "string") {
    evaluateSet = evaluateLater(scopeTarget, `${expression()} = __placeholder`);
  } else {
    evaluateSet = () => {};
  }

  let getValue = () => {
    let result;
    evaluateGet(value => result = value);
    return isGetterSetter(result) ? result.get() : result;
  };

  let setValue = value => {
    let result;
    evaluateGet(value2 => result = value2);

    if (isGetterSetter(result)) {
      result.set(value);
    } else {
      evaluateSet(() => {}, {
        scope: {
          "__placeholder": value
        }
      });
    }
  };

  if (modifiers.includes("fill") && el.hasAttribute("value") && (getValue() === null || getValue() === "")) {
    setValue(el.value);
  }

  if (typeof expression === "string" && el.type === "radio") {
    mutateDom(() => {
      if (!el.hasAttribute("name")) el.setAttribute("name", expression);
    });
  }

  var event = el.tagName.toLowerCase() === "select" || ["checkbox", "radio"].includes(el.type) || modifiers.includes("lazy") ? "change" : "input";
  let removeListener = isCloning ? () => {} : on(el, event, modifiers, e => {
    setValue(getInputValue(el, modifiers, e, getValue()));
  });
  if (!el._x_removeModelListeners) el._x_removeModelListeners = {};
  el._x_removeModelListeners["default"] = removeListener;
  cleanup2(() => el._x_removeModelListeners["default"]());

  if (el.form) {
    let removeResetListener = on(el.form, "reset", [], e => {
      nextTick(() => el._x_model && el._x_model.set(el.value));
    });
    cleanup2(() => removeResetListener());
  }

  el._x_model = {
    get() {
      return getValue();
    },

    set(value) {
      setValue(value);
    }

  };

  el._x_forceModelUpdate = value => {
    value = value === void 0 ? getValue() : value;
    if (value === void 0 && typeof expression === "string" && expression.match(/\./)) value = "";
    window.fromModel = true;
    mutateDom(() => bind(el, "value", value));
    delete window.fromModel;
  };

  effect3(() => {
    let value = getValue();
    if (modifiers.includes("unintrusive") && document.activeElement.isSameNode(el)) return;

    el._x_forceModelUpdate(value);
  });
});

function getInputValue(el, modifiers, event, currentValue) {
  return mutateDom(() => {
    if (event instanceof CustomEvent && event.detail !== void 0) {
      return typeof event.detail != "undefined" ? event.detail : event.target.value;
    } else if (el.type === "checkbox") {
      if (Array.isArray(currentValue)) {
        let newValue = modifiers.includes("number") ? safeParseNumber(event.target.value) : event.target.value;
        return event.target.checked ? currentValue.concat([newValue]) : currentValue.filter(el2 => !checkedAttrLooseCompare2(el2, newValue));
      } else {
        return event.target.checked;
      }
    } else if (el.tagName.toLowerCase() === "select" && el.multiple) {
      return modifiers.includes("number") ? Array.from(event.target.selectedOptions).map(option => {
        let rawValue = option.value || option.text;
        return safeParseNumber(rawValue);
      }) : Array.from(event.target.selectedOptions).map(option => {
        return option.value || option.text;
      });
    } else {
      let rawValue = event.target.value;
      return modifiers.includes("number") ? safeParseNumber(rawValue) : modifiers.includes("trim") ? rawValue.trim() : rawValue;
    }
  });
}

function safeParseNumber(rawValue) {
  let number = rawValue ? parseFloat(rawValue) : null;
  return isNumeric2(number) ? number : rawValue;
}

function checkedAttrLooseCompare2(valueA, valueB) {
  return valueA == valueB;
}

function isNumeric2(subject) {
  return !Array.isArray(subject) && !isNaN(subject);
}

function isGetterSetter(value) {
  return value !== null && typeof value === "object" && typeof value.get === "function" && typeof value.set === "function";
} // packages/alpinejs/src/directives/x-cloak.js


directive("cloak", el => queueMicrotask(() => mutateDom(() => el.removeAttribute(prefix("cloak"))))); // packages/alpinejs/src/directives/x-init.js

addInitSelector(() => `[${prefix("init")}]`);
directive("init", skipDuringClone((el, _ref35, _ref36) => {
  let {
    expression
  } = _ref35;
  let {
    evaluate: evaluate2
  } = _ref36;

  if (typeof expression === "string") {
    return !!expression.trim() && evaluate2(expression, {}, false);
  }

  return evaluate2(expression, {}, false);
})); // packages/alpinejs/src/directives/x-text.js

directive("text", (el, _ref37, _ref38) => {
  let {
    expression
  } = _ref37;
  let {
    effect: effect3,
    evaluateLater: evaluateLater2
  } = _ref38;
  let evaluate2 = evaluateLater2(expression);
  effect3(() => {
    evaluate2(value => {
      mutateDom(() => {
        el.textContent = value;
      });
    });
  });
}); // packages/alpinejs/src/directives/x-html.js

directive("html", (el, _ref39, _ref40) => {
  let {
    expression
  } = _ref39;
  let {
    effect: effect3,
    evaluateLater: evaluateLater2
  } = _ref40;
  let evaluate2 = evaluateLater2(expression);
  effect3(() => {
    evaluate2(value => {
      mutateDom(() => {
        el.innerHTML = value;
        el._x_ignoreSelf = true;
        initTree(el);
        delete el._x_ignoreSelf;
      });
    });
  });
}); // packages/alpinejs/src/directives/x-bind.js

mapAttributes(startingWith(":", into(prefix("bind:"))));
directive("bind", (el, _ref41, _ref42) => {
  let {
    value,
    modifiers,
    expression,
    original
  } = _ref41;
  let {
    effect: effect3
  } = _ref42;

  if (!value) {
    let bindingProviders = {};
    injectBindingProviders(bindingProviders);
    let getBindings = evaluateLater(el, expression);
    getBindings(bindings => {
      applyBindingsObject(el, bindings, original);
    }, {
      scope: bindingProviders
    });
    return;
  }

  if (value === "key") return storeKeyForXFor(el, expression);
  let evaluate2 = evaluateLater(el, expression);
  effect3(() => evaluate2(result => {
    if (result === void 0 && typeof expression === "string" && expression.match(/\./)) {
      result = "";
    }

    mutateDom(() => bind(el, value, result, modifiers));
  }));
});

function storeKeyForXFor(el, expression) {
  el._x_keyExpression = expression;
} // packages/alpinejs/src/directives/x-data.js


addRootSelector(() => `[${prefix("data")}]`);
directive("data", skipDuringClone((el, _ref43, _ref44) => {
  let {
    expression
  } = _ref43;
  let {
    cleanup: cleanup2
  } = _ref44;
  expression = expression === "" ? "{}" : expression;
  let magicContext = {};
  injectMagics(magicContext, el);
  let dataProviderContext = {};
  injectDataProviders(dataProviderContext, magicContext);
  let data2 = evaluate(el, expression, {
    scope: dataProviderContext
  });
  if (data2 === void 0 || data2 === true) data2 = {};
  injectMagics(data2, el);
  let reactiveData = reactive(data2);
  initInterceptors(reactiveData);
  let undo = addScopeToNode(el, reactiveData);
  reactiveData["init"] && evaluate(el, reactiveData["init"]);
  cleanup2(() => {
    reactiveData["destroy"] && evaluate(el, reactiveData["destroy"]);
    undo();
  });
})); // packages/alpinejs/src/directives/x-show.js

directive("show", (el, _ref45, _ref46) => {
  let {
    modifiers,
    expression
  } = _ref45;
  let {
    effect: effect3
  } = _ref46;
  let evaluate2 = evaluateLater(el, expression);
  if (!el._x_doHide) el._x_doHide = () => {
    mutateDom(() => {
      el.style.setProperty("display", "none", modifiers.includes("important") ? "important" : void 0);
    });
  };
  if (!el._x_doShow) el._x_doShow = () => {
    mutateDom(() => {
      if (el.style.length === 1 && el.style.display === "none") {
        el.removeAttribute("style");
      } else {
        el.style.removeProperty("display");
      }
    });
  };

  let hide = () => {
    el._x_doHide();

    el._x_isShown = false;
  };

  let show = () => {
    el._x_doShow();

    el._x_isShown = true;
  };

  let clickAwayCompatibleShow = () => setTimeout(show);

  let toggle = once(value => value ? show() : hide(), value => {
    if (typeof el._x_toggleAndCascadeWithTransitions === "function") {
      el._x_toggleAndCascadeWithTransitions(el, value, show, hide);
    } else {
      value ? clickAwayCompatibleShow() : hide();
    }
  });
  let oldValue;
  let firstTime = true;
  effect3(() => evaluate2(value => {
    if (!firstTime && value === oldValue) return;
    if (modifiers.includes("immediate")) value ? clickAwayCompatibleShow() : hide();
    toggle(value);
    oldValue = value;
    firstTime = false;
  }));
}); // packages/alpinejs/src/directives/x-for.js

directive("for", (el, _ref47, _ref48) => {
  let {
    expression
  } = _ref47;
  let {
    effect: effect3,
    cleanup: cleanup2
  } = _ref48;
  let iteratorNames = parseForExpression(expression);
  let evaluateItems = evaluateLater(el, iteratorNames.items);
  let evaluateKey = evaluateLater(el, // the x-bind:key expression is stored for our use instead of evaluated.
  el._x_keyExpression || "index");
  el._x_prevKeys = [];
  el._x_lookup = {};
  effect3(() => loop(el, iteratorNames, evaluateItems, evaluateKey));
  cleanup2(() => {
    Object.values(el._x_lookup).forEach(el2 => el2.remove());
    delete el._x_prevKeys;
    delete el._x_lookup;
  });
});

function loop(el, iteratorNames, evaluateItems, evaluateKey) {
  let isObject2 = i => typeof i === "object" && !Array.isArray(i);

  let templateEl = el;
  evaluateItems(items => {
    if (isNumeric3(items) && items >= 0) {
      items = Array.from(Array(items).keys(), i => i + 1);
    }

    if (items === void 0) items = [];
    let lookup = el._x_lookup;
    let prevKeys = el._x_prevKeys;
    let scopes = [];
    let keys = [];

    if (isObject2(items)) {
      items = Object.entries(items).map(_ref49 => {
        let [key, value] = _ref49;
        let scope2 = getIterationScopeVariables(iteratorNames, value, key, items);
        evaluateKey(value2 => keys.push(value2), {
          scope: {
            index: key,
            ...scope2
          }
        });
        scopes.push(scope2);
      });
    } else {
      for (let i = 0; i < items.length; i++) {
        let scope2 = getIterationScopeVariables(iteratorNames, items[i], i, items);
        evaluateKey(value => keys.push(value), {
          scope: {
            index: i,
            ...scope2
          }
        });
        scopes.push(scope2);
      }
    }

    let adds = [];
    let moves = [];
    let removes = [];
    let sames = [];

    for (let i = 0; i < prevKeys.length; i++) {
      let key = prevKeys[i];
      if (keys.indexOf(key) === -1) removes.push(key);
    }

    prevKeys = prevKeys.filter(key => !removes.includes(key));
    let lastKey = "template";

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let prevIndex = prevKeys.indexOf(key);

      if (prevIndex === -1) {
        prevKeys.splice(i, 0, key);
        adds.push([lastKey, i]);
      } else if (prevIndex !== i) {
        let keyInSpot = prevKeys.splice(i, 1)[0];
        let keyForSpot = prevKeys.splice(prevIndex - 1, 1)[0];
        prevKeys.splice(i, 0, keyForSpot);
        prevKeys.splice(prevIndex, 0, keyInSpot);
        moves.push([keyInSpot, keyForSpot]);
      } else {
        sames.push(key);
      }

      lastKey = key;
    }

    for (let i = 0; i < removes.length; i++) {
      let key = removes[i];

      if (!!lookup[key]._x_effects) {
        lookup[key]._x_effects.forEach(dequeueJob);
      }

      lookup[key].remove();
      lookup[key] = null;
      delete lookup[key];
    }

    for (let i = 0; i < moves.length; i++) {
      let [keyInSpot, keyForSpot] = moves[i];
      let elInSpot = lookup[keyInSpot];
      let elForSpot = lookup[keyForSpot];
      let marker = document.createElement("div");
      mutateDom(() => {
        elForSpot.after(marker);
        elInSpot.after(elForSpot);
        elForSpot._x_currentIfEl && elForSpot.after(elForSpot._x_currentIfEl);
        marker.before(elInSpot);
        elInSpot._x_currentIfEl && elInSpot.after(elInSpot._x_currentIfEl);
        marker.remove();
      });
      refreshScope(elForSpot, scopes[keys.indexOf(keyForSpot)]);
    }

    for (let i = 0; i < adds.length; i++) {
      let [lastKey2, index] = adds[i];
      let lastEl = lastKey2 === "template" ? templateEl : lookup[lastKey2];
      if (lastEl._x_currentIfEl) lastEl = lastEl._x_currentIfEl;
      let scope2 = scopes[index];
      let key = keys[index];
      let clone2 = document.importNode(templateEl.content, true).firstElementChild;
      addScopeToNode(clone2, reactive(scope2), templateEl);
      mutateDom(() => {
        lastEl.after(clone2);
        initTree(clone2);
      });

      if (typeof key === "object") {
        warn("x-for key cannot be an object, it must be a string or an integer", templateEl);
      }

      lookup[key] = clone2;
    }

    for (let i = 0; i < sames.length; i++) {
      refreshScope(lookup[sames[i]], scopes[keys.indexOf(sames[i])]);
    }

    templateEl._x_prevKeys = keys;
  });
}

function parseForExpression(expression) {
  let forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/;
  let stripParensRE = /^\s*\(|\)\s*$/g;
  let forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/;
  let inMatch = expression.match(forAliasRE);
  if (!inMatch) return;
  let res = {};
  res.items = inMatch[2].trim();
  let item = inMatch[1].replace(stripParensRE, "").trim();
  let iteratorMatch = item.match(forIteratorRE);

  if (iteratorMatch) {
    res.item = item.replace(forIteratorRE, "").trim();
    res.index = iteratorMatch[1].trim();

    if (iteratorMatch[2]) {
      res.collection = iteratorMatch[2].trim();
    }
  } else {
    res.item = item;
  }

  return res;
}

function getIterationScopeVariables(iteratorNames, item, index, items) {
  let scopeVariables = {};

  if (/^\[.*\]$/.test(iteratorNames.item) && Array.isArray(item)) {
    let names = iteratorNames.item.replace("[", "").replace("]", "").split(",").map(i => i.trim());
    names.forEach((name, i) => {
      scopeVariables[name] = item[i];
    });
  } else if (/^\{.*\}$/.test(iteratorNames.item) && !Array.isArray(item) && typeof item === "object") {
    let names = iteratorNames.item.replace("{", "").replace("}", "").split(",").map(i => i.trim());
    names.forEach(name => {
      scopeVariables[name] = item[name];
    });
  } else {
    scopeVariables[iteratorNames.item] = item;
  }

  if (iteratorNames.index) scopeVariables[iteratorNames.index] = index;
  if (iteratorNames.collection) scopeVariables[iteratorNames.collection] = items;
  return scopeVariables;
}

function isNumeric3(subject) {
  return !Array.isArray(subject) && !isNaN(subject);
} // packages/alpinejs/src/directives/x-ref.js


function handler2() {}

handler2.inline = (el, _ref50, _ref51) => {
  let {
    expression
  } = _ref50;
  let {
    cleanup: cleanup2
  } = _ref51;
  let root = closestRoot(el);
  if (!root._x_refs) root._x_refs = {};
  root._x_refs[expression] = el;
  cleanup2(() => delete root._x_refs[expression]);
};

directive("ref", handler2); // packages/alpinejs/src/directives/x-if.js

directive("if", (el, _ref52, _ref53) => {
  let {
    expression
  } = _ref52;
  let {
    effect: effect3,
    cleanup: cleanup2
  } = _ref53;
  let evaluate2 = evaluateLater(el, expression);

  let show = () => {
    if (el._x_currentIfEl) return el._x_currentIfEl;
    let clone2 = el.content.cloneNode(true).firstElementChild;
    addScopeToNode(clone2, {}, el);
    mutateDom(() => {
      el.after(clone2);
      initTree(clone2);
    });
    el._x_currentIfEl = clone2;

    el._x_undoIf = () => {
      walk(clone2, node => {
        if (!!node._x_effects) {
          node._x_effects.forEach(dequeueJob);
        }
      });
      clone2.remove();
      delete el._x_currentIfEl;
    };

    return clone2;
  };

  let hide = () => {
    if (!el._x_undoIf) return;

    el._x_undoIf();

    delete el._x_undoIf;
  };

  effect3(() => evaluate2(value => {
    value ? show() : hide();
  }));
  cleanup2(() => el._x_undoIf && el._x_undoIf());
}); // packages/alpinejs/src/directives/x-id.js

directive("id", (el, _ref54, _ref55) => {
  let {
    expression
  } = _ref54;
  let {
    evaluate: evaluate2
  } = _ref55;
  let names = evaluate2(expression);
  names.forEach(name => setIdRoot(el, name));
}); // packages/alpinejs/src/directives/x-on.js

mapAttributes(startingWith("@", into(prefix("on:"))));
directive("on", skipDuringClone((el, _ref56, _ref57) => {
  let {
    value,
    modifiers,
    expression
  } = _ref56;
  let {
    cleanup: cleanup2
  } = _ref57;
  let evaluate2 = expression ? evaluateLater(el, expression) : () => {};

  if (el.tagName.toLowerCase() === "template") {
    if (!el._x_forwardEvents) el._x_forwardEvents = [];
    if (!el._x_forwardEvents.includes(value)) el._x_forwardEvents.push(value);
  }

  let removeListener = on(el, value, modifiers, e => {
    evaluate2(() => {}, {
      scope: {
        "$event": e
      },
      params: [e]
    });
  });
  cleanup2(() => removeListener());
})); // packages/alpinejs/src/directives/index.js

warnMissingPluginDirective("Collapse", "collapse", "collapse");
warnMissingPluginDirective("Intersect", "intersect", "intersect");
warnMissingPluginDirective("Focus", "trap", "focus");
warnMissingPluginDirective("Mask", "mask", "mask");

function warnMissingPluginDirective(name, directiveName2, slug) {
  directive(directiveName2, el => warn(`You can't use [x-${directiveName2}] without first installing the "${name}" plugin here: https://alpinejs.dev/plugins/${slug}`, el));
} // packages/alpinejs/src/index.js


alpine_default.setEvaluator(normalEvaluator);
alpine_default.setReactivityEngine({
  reactive: reactive2,
  effect: effect2,
  release: stop,
  raw: toRaw
});
var src_default$4 = alpine_default; // packages/alpinejs/builds/module.js

var module_default$4 = src_default$4; // packages/intersect/src/index.js

function src_default$3(Alpine) {
  Alpine.directive("intersect", (el, _ref58, _ref59) => {
    let {
      value,
      expression,
      modifiers
    } = _ref58;
    let {
      evaluateLater,
      cleanup
    } = _ref59;
    let evaluate = evaluateLater(expression);
    let options = {
      rootMargin: getRootMargin(modifiers),
      threshold: getThreshhold(modifiers)
    };
    let observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting === (value === "leave")) return;
        evaluate();
        modifiers.includes("once") && observer.disconnect();
      });
    }, options);
    observer.observe(el);
    cleanup(() => {
      observer.disconnect();
    });
  });
}

function getThreshhold(modifiers) {
  if (modifiers.includes("full")) return 0.99;
  if (modifiers.includes("half")) return 0.5;
  if (!modifiers.includes("threshold")) return 0;
  let threshold = modifiers[modifiers.indexOf("threshold") + 1];
  if (threshold === "100") return 1;
  if (threshold === "0") return 0;
  return Number(`.${threshold}`);
}

function getLengthValue(rawValue) {
  let match = rawValue.match(/^(-?[0-9]+)(px|%)?$/);
  return match ? match[1] + (match[2] || "px") : void 0;
}

function getRootMargin(modifiers) {
  const key = "margin";
  const fallback = "0px 0px 0px 0px";
  const index = modifiers.indexOf(key);
  if (index === -1) return fallback;
  let values = [];

  for (let i = 1; i < 5; i++) {
    values.push(getLengthValue(modifiers[index + i] || ""));
  }

  values = values.filter(v => v !== void 0);
  return values.length ? values.join(" ").trim() : fallback;
} // packages/intersect/builds/module.js


var module_default$3 = src_default$3; // node_modules/tabbable/dist/index.esm.js

var candidateSelectors = ["input", "select", "textarea", "a[href]", "button", "[tabindex]", "audio[controls]", "video[controls]", '[contenteditable]:not([contenteditable="false"])', "details>summary:first-of-type", "details"];
var candidateSelector = /* @__PURE__ */candidateSelectors.join(",");
var matches = typeof Element === "undefined" ? function () {} : Element.prototype.matches || Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;

var getCandidates = function getCandidates2(el, includeContainer, filter) {
  var candidates = Array.prototype.slice.apply(el.querySelectorAll(candidateSelector));

  if (includeContainer && matches.call(el, candidateSelector)) {
    candidates.unshift(el);
  }

  candidates = candidates.filter(filter);
  return candidates;
};

var isContentEditable = function isContentEditable2(node) {
  return node.contentEditable === "true";
};

var getTabindex = function getTabindex2(node) {
  var tabindexAttr = parseInt(node.getAttribute("tabindex"), 10);

  if (!isNaN(tabindexAttr)) {
    return tabindexAttr;
  }

  if (isContentEditable(node)) {
    return 0;
  }

  if ((node.nodeName === "AUDIO" || node.nodeName === "VIDEO" || node.nodeName === "DETAILS") && node.getAttribute("tabindex") === null) {
    return 0;
  }

  return node.tabIndex;
};

var sortOrderedTabbables = function sortOrderedTabbables2(a, b) {
  return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
};

var isInput = function isInput2(node) {
  return node.tagName === "INPUT";
};

var isHiddenInput = function isHiddenInput2(node) {
  return isInput(node) && node.type === "hidden";
};

var isDetailsWithSummary = function isDetailsWithSummary2(node) {
  var r = node.tagName === "DETAILS" && Array.prototype.slice.apply(node.children).some(function (child) {
    return child.tagName === "SUMMARY";
  });
  return r;
};

var getCheckedRadio = function getCheckedRadio2(nodes, form) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].checked && nodes[i].form === form) {
      return nodes[i];
    }
  }
};

var isTabbableRadio = function isTabbableRadio2(node) {
  if (!node.name) {
    return true;
  }

  var radioScope = node.form || node.ownerDocument;

  var queryRadios = function queryRadios2(name) {
    return radioScope.querySelectorAll('input[type="radio"][name="' + name + '"]');
  };

  var radioSet;

  if (typeof window !== "undefined" && typeof window.CSS !== "undefined" && typeof window.CSS.escape === "function") {
    radioSet = queryRadios(window.CSS.escape(node.name));
  } else {
    try {
      radioSet = queryRadios(node.name);
    } catch (err) {
      console.error("Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s", err.message);
      return false;
    }
  }

  var checked = getCheckedRadio(radioSet, node.form);
  return !checked || checked === node;
};

var isRadio = function isRadio2(node) {
  return isInput(node) && node.type === "radio";
};

var isNonTabbableRadio = function isNonTabbableRadio2(node) {
  return isRadio(node) && !isTabbableRadio(node);
};

var isHidden = function isHidden2(node, displayCheck) {
  if (getComputedStyle(node).visibility === "hidden") {
    return true;
  }

  var isDirectSummary = matches.call(node, "details>summary:first-of-type");
  var nodeUnderDetails = isDirectSummary ? node.parentElement : node;

  if (matches.call(nodeUnderDetails, "details:not([open]) *")) {
    return true;
  }

  if (!displayCheck || displayCheck === "full") {
    while (node) {
      if (getComputedStyle(node).display === "none") {
        return true;
      }

      node = node.parentElement;
    }
  } else if (displayCheck === "non-zero-area") {
    var _node$getBoundingClie = node.getBoundingClientRect(),
        width = _node$getBoundingClie.width,
        height = _node$getBoundingClie.height;

    return width === 0 && height === 0;
  }

  return false;
};

var isDisabledFromFieldset = function isDisabledFromFieldset2(node) {
  if (isInput(node) || node.tagName === "SELECT" || node.tagName === "TEXTAREA" || node.tagName === "BUTTON") {
    var parentNode = node.parentElement;

    while (parentNode) {
      if (parentNode.tagName === "FIELDSET" && parentNode.disabled) {
        for (var i = 0; i < parentNode.children.length; i++) {
          var child = parentNode.children.item(i);

          if (child.tagName === "LEGEND") {
            if (child.contains(node)) {
              return false;
            }

            return true;
          }
        }

        return true;
      }

      parentNode = parentNode.parentElement;
    }
  }

  return false;
};

var isNodeMatchingSelectorFocusable = function isNodeMatchingSelectorFocusable2(options, node) {
  if (node.disabled || isHiddenInput(node) || isHidden(node, options.displayCheck) || // For a details element with a summary, the summary element gets the focus
  isDetailsWithSummary(node) || isDisabledFromFieldset(node)) {
    return false;
  }

  return true;
};

var isNodeMatchingSelectorTabbable = function isNodeMatchingSelectorTabbable2(options, node) {
  if (!isNodeMatchingSelectorFocusable(options, node) || isNonTabbableRadio(node) || getTabindex(node) < 0) {
    return false;
  }

  return true;
};

var tabbable = function tabbable2(el, options) {
  options = options || {};
  var regularTabbables = [];
  var orderedTabbables = [];
  var candidates = getCandidates(el, options.includeContainer, isNodeMatchingSelectorTabbable.bind(null, options));
  candidates.forEach(function (candidate, i) {
    var candidateTabindex = getTabindex(candidate);

    if (candidateTabindex === 0) {
      regularTabbables.push(candidate);
    } else {
      orderedTabbables.push({
        documentOrder: i,
        tabIndex: candidateTabindex,
        node: candidate
      });
    }
  });
  var tabbableNodes = orderedTabbables.sort(sortOrderedTabbables).map(function (a) {
    return a.node;
  }).concat(regularTabbables);
  return tabbableNodes;
};

var focusable = function focusable2(el, options) {
  options = options || {};
  var candidates = getCandidates(el, options.includeContainer, isNodeMatchingSelectorFocusable.bind(null, options));
  return candidates;
};

var focusableCandidateSelector = /* @__PURE__ */candidateSelectors.concat("iframe").join(",");

var isFocusable = function isFocusable2(node, options) {
  options = options || {};

  if (!node) {
    throw new Error("No node provided");
  }

  if (matches.call(node, focusableCandidateSelector) === false) {
    return false;
  }

  return isNodeMatchingSelectorFocusable(options, node);
}; // node_modules/focus-trap/dist/focus-trap.esm.js


function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);

    if (enumerableOnly) {
      symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }

    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

var activeFocusTraps = function () {
  var trapQueue = [];
  return {
    activateTrap: function activateTrap(trap) {
      if (trapQueue.length > 0) {
        var activeTrap = trapQueue[trapQueue.length - 1];

        if (activeTrap !== trap) {
          activeTrap.pause();
        }
      }

      var trapIndex = trapQueue.indexOf(trap);

      if (trapIndex === -1) {
        trapQueue.push(trap);
      } else {
        trapQueue.splice(trapIndex, 1);
        trapQueue.push(trap);
      }
    },
    deactivateTrap: function deactivateTrap(trap) {
      var trapIndex = trapQueue.indexOf(trap);

      if (trapIndex !== -1) {
        trapQueue.splice(trapIndex, 1);
      }

      if (trapQueue.length > 0) {
        trapQueue[trapQueue.length - 1].unpause();
      }
    }
  };
}();

var isSelectableInput = function isSelectableInput2(node) {
  return node.tagName && node.tagName.toLowerCase() === "input" && typeof node.select === "function";
};

var isEscapeEvent = function isEscapeEvent2(e) {
  return e.key === "Escape" || e.key === "Esc" || e.keyCode === 27;
};

var isTabEvent = function isTabEvent2(e) {
  return e.key === "Tab" || e.keyCode === 9;
};

var delay = function delay2(fn) {
  return setTimeout(fn, 0);
};

var findIndex = function findIndex2(arr, fn) {
  var idx = -1;
  arr.every(function (value, i) {
    if (fn(value)) {
      idx = i;
      return false;
    }

    return true;
  });
  return idx;
};

var valueOrHandler = function valueOrHandler2(value) {
  for (var _len = arguments.length, params = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    params[_key - 1] = arguments[_key];
  }

  return typeof value === "function" ? value.apply(void 0, params) : value;
};

var createFocusTrap = function createFocusTrap2(elements, userOptions) {
  var doc = document;

  var config = _objectSpread2({
    returnFocusOnDeactivate: true,
    escapeDeactivates: true,
    delayInitialFocus: true
  }, userOptions);

  var state = {
    // @type {Array<HTMLElement>}
    containers: [],
    // list of objects identifying the first and last tabbable nodes in all containers/groups in
    //  the trap
    // NOTE: it's possible that a group has no tabbable nodes if nodes get removed while the trap
    //  is active, but the trap should never get to a state where there isn't at least one group
    //  with at least one tabbable node in it (that would lead to an error condition that would
    //  result in an error being thrown)
    // @type {Array<{ container: HTMLElement, firstTabbableNode: HTMLElement|null, lastTabbableNode: HTMLElement|null }>}
    tabbableGroups: [],
    nodeFocusedBeforeActivation: null,
    mostRecentlyFocusedNode: null,
    active: false,
    paused: false,
    // timer ID for when delayInitialFocus is true and initial focus in this trap
    //  has been delayed during activation
    delayInitialFocusTimer: void 0
  };
  var trap;

  var getOption = function getOption2(configOverrideOptions, optionName, configOptionName) {
    return configOverrideOptions && configOverrideOptions[optionName] !== void 0 ? configOverrideOptions[optionName] : config[configOptionName || optionName];
  };

  var containersContain = function containersContain2(element) {
    return state.containers.some(function (container) {
      return container.contains(element);
    });
  };

  var getNodeForOption = function getNodeForOption2(optionName) {
    var optionValue = config[optionName];

    if (!optionValue) {
      return null;
    }

    var node = optionValue;

    if (typeof optionValue === "string") {
      node = doc.querySelector(optionValue);

      if (!node) {
        throw new Error("`".concat(optionName, "` refers to no known node"));
      }
    }

    if (typeof optionValue === "function") {
      node = optionValue();

      if (!node) {
        throw new Error("`".concat(optionName, "` did not return a node"));
      }
    }

    return node;
  };

  var getInitialFocusNode = function getInitialFocusNode2() {
    var node;

    if (getOption({}, "initialFocus") === false) {
      return false;
    }

    if (getNodeForOption("initialFocus") !== null) {
      node = getNodeForOption("initialFocus");
    } else if (containersContain(doc.activeElement)) {
      node = doc.activeElement;
    } else {
      var firstTabbableGroup = state.tabbableGroups[0];
      var firstTabbableNode = firstTabbableGroup && firstTabbableGroup.firstTabbableNode;
      node = firstTabbableNode || getNodeForOption("fallbackFocus");
    }

    if (!node) {
      throw new Error("Your focus-trap needs to have at least one focusable element");
    }

    return node;
  };

  var updateTabbableNodes = function updateTabbableNodes2() {
    state.tabbableGroups = state.containers.map(function (container) {
      var tabbableNodes = tabbable(container);

      if (tabbableNodes.length > 0) {
        return {
          container,
          firstTabbableNode: tabbableNodes[0],
          lastTabbableNode: tabbableNodes[tabbableNodes.length - 1]
        };
      }

      return void 0;
    }).filter(function (group) {
      return !!group;
    });

    if (state.tabbableGroups.length <= 0 && !getNodeForOption("fallbackFocus")) {
      throw new Error("Your focus-trap must have at least one container with at least one tabbable node in it at all times");
    }
  };

  var tryFocus = function tryFocus2(node) {
    if (node === false) {
      return;
    }

    if (node === doc.activeElement) {
      return;
    }

    if (!node || !node.focus) {
      tryFocus2(getInitialFocusNode());
      return;
    }

    node.focus({
      preventScroll: !!config.preventScroll
    });
    state.mostRecentlyFocusedNode = node;

    if (isSelectableInput(node)) {
      node.select();
    }
  };

  var getReturnFocusNode = function getReturnFocusNode2(previousActiveElement) {
    var node = getNodeForOption("setReturnFocus");
    return node ? node : previousActiveElement;
  };

  var checkPointerDown = function checkPointerDown2(e) {
    if (containersContain(e.target)) {
      return;
    }

    if (valueOrHandler(config.clickOutsideDeactivates, e)) {
      trap.deactivate({
        // if, on deactivation, we should return focus to the node originally-focused
        //  when the trap was activated (or the configured `setReturnFocus` node),
        //  then assume it's also OK to return focus to the outside node that was
        //  just clicked, causing deactivation, as long as that node is focusable;
        //  if it isn't focusable, then return focus to the original node focused
        //  on activation (or the configured `setReturnFocus` node)
        // NOTE: by setting `returnFocus: false`, deactivate() will do nothing,
        //  which will result in the outside click setting focus to the node
        //  that was clicked, whether it's focusable or not; by setting
        //  `returnFocus: true`, we'll attempt to re-focus the node originally-focused
        //  on activation (or the configured `setReturnFocus` node)
        returnFocus: config.returnFocusOnDeactivate && !isFocusable(e.target)
      });
      return;
    }

    if (valueOrHandler(config.allowOutsideClick, e)) {
      return;
    }

    e.preventDefault();
  };

  var checkFocusIn = function checkFocusIn2(e) {
    var targetContained = containersContain(e.target);

    if (targetContained || e.target instanceof Document) {
      if (targetContained) {
        state.mostRecentlyFocusedNode = e.target;
      }
    } else {
      e.stopImmediatePropagation();
      tryFocus(state.mostRecentlyFocusedNode || getInitialFocusNode());
    }
  };

  var checkTab = function checkTab2(e) {
    updateTabbableNodes();
    var destinationNode = null;

    if (state.tabbableGroups.length > 0) {
      var containerIndex = findIndex(state.tabbableGroups, function (_ref) {
        var container = _ref.container;
        return container.contains(e.target);
      });

      if (containerIndex < 0) {
        if (e.shiftKey) {
          destinationNode = state.tabbableGroups[state.tabbableGroups.length - 1].lastTabbableNode;
        } else {
          destinationNode = state.tabbableGroups[0].firstTabbableNode;
        }
      } else if (e.shiftKey) {
        var startOfGroupIndex = findIndex(state.tabbableGroups, function (_ref2) {
          var firstTabbableNode = _ref2.firstTabbableNode;
          return e.target === firstTabbableNode;
        });

        if (startOfGroupIndex < 0 && state.tabbableGroups[containerIndex].container === e.target) {
          startOfGroupIndex = containerIndex;
        }

        if (startOfGroupIndex >= 0) {
          var destinationGroupIndex = startOfGroupIndex === 0 ? state.tabbableGroups.length - 1 : startOfGroupIndex - 1;
          var destinationGroup = state.tabbableGroups[destinationGroupIndex];
          destinationNode = destinationGroup.lastTabbableNode;
        }
      } else {
        var lastOfGroupIndex = findIndex(state.tabbableGroups, function (_ref3) {
          var lastTabbableNode = _ref3.lastTabbableNode;
          return e.target === lastTabbableNode;
        });

        if (lastOfGroupIndex < 0 && state.tabbableGroups[containerIndex].container === e.target) {
          lastOfGroupIndex = containerIndex;
        }

        if (lastOfGroupIndex >= 0) {
          var _destinationGroupIndex = lastOfGroupIndex === state.tabbableGroups.length - 1 ? 0 : lastOfGroupIndex + 1;

          var _destinationGroup = state.tabbableGroups[_destinationGroupIndex];
          destinationNode = _destinationGroup.firstTabbableNode;
        }
      }
    } else {
      destinationNode = getNodeForOption("fallbackFocus");
    }

    if (destinationNode) {
      e.preventDefault();
      tryFocus(destinationNode);
    }
  };

  var checkKey = function checkKey2(e) {
    if (isEscapeEvent(e) && valueOrHandler(config.escapeDeactivates) !== false) {
      e.preventDefault();
      trap.deactivate();
      return;
    }

    if (isTabEvent(e)) {
      checkTab(e);
      return;
    }
  };

  var checkClick = function checkClick2(e) {
    if (valueOrHandler(config.clickOutsideDeactivates, e)) {
      return;
    }

    if (containersContain(e.target)) {
      return;
    }

    if (valueOrHandler(config.allowOutsideClick, e)) {
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
  };

  var addListeners = function addListeners2() {
    if (!state.active) {
      return;
    }

    activeFocusTraps.activateTrap(trap);
    state.delayInitialFocusTimer = config.delayInitialFocus ? delay(function () {
      tryFocus(getInitialFocusNode());
    }) : tryFocus(getInitialFocusNode());
    doc.addEventListener("focusin", checkFocusIn, true);
    doc.addEventListener("mousedown", checkPointerDown, {
      capture: true,
      passive: false
    });
    doc.addEventListener("touchstart", checkPointerDown, {
      capture: true,
      passive: false
    });
    doc.addEventListener("click", checkClick, {
      capture: true,
      passive: false
    });
    doc.addEventListener("keydown", checkKey, {
      capture: true,
      passive: false
    });
    return trap;
  };

  var removeListeners = function removeListeners2() {
    if (!state.active) {
      return;
    }

    doc.removeEventListener("focusin", checkFocusIn, true);
    doc.removeEventListener("mousedown", checkPointerDown, true);
    doc.removeEventListener("touchstart", checkPointerDown, true);
    doc.removeEventListener("click", checkClick, true);
    doc.removeEventListener("keydown", checkKey, true);
    return trap;
  };

  trap = {
    activate: function activate(activateOptions) {
      if (state.active) {
        return this;
      }

      var onActivate = getOption(activateOptions, "onActivate");
      var onPostActivate = getOption(activateOptions, "onPostActivate");
      var checkCanFocusTrap = getOption(activateOptions, "checkCanFocusTrap");

      if (!checkCanFocusTrap) {
        updateTabbableNodes();
      }

      state.active = true;
      state.paused = false;
      state.nodeFocusedBeforeActivation = doc.activeElement;

      if (onActivate) {
        onActivate();
      }

      var finishActivation = function finishActivation2() {
        if (checkCanFocusTrap) {
          updateTabbableNodes();
        }

        addListeners();

        if (onPostActivate) {
          onPostActivate();
        }
      };

      if (checkCanFocusTrap) {
        checkCanFocusTrap(state.containers.concat()).then(finishActivation, finishActivation);
        return this;
      }

      finishActivation();
      return this;
    },
    deactivate: function deactivate(deactivateOptions) {
      if (!state.active) {
        return this;
      }

      clearTimeout(state.delayInitialFocusTimer);
      state.delayInitialFocusTimer = void 0;
      removeListeners();
      state.active = false;
      state.paused = false;
      activeFocusTraps.deactivateTrap(trap);
      var onDeactivate = getOption(deactivateOptions, "onDeactivate");
      var onPostDeactivate = getOption(deactivateOptions, "onPostDeactivate");
      var checkCanReturnFocus = getOption(deactivateOptions, "checkCanReturnFocus");

      if (onDeactivate) {
        onDeactivate();
      }

      var returnFocus = getOption(deactivateOptions, "returnFocus", "returnFocusOnDeactivate");

      var finishDeactivation = function finishDeactivation2() {
        delay(function () {
          if (returnFocus) {
            tryFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation));
          }

          if (onPostDeactivate) {
            onPostDeactivate();
          }
        });
      };

      if (returnFocus && checkCanReturnFocus) {
        checkCanReturnFocus(getReturnFocusNode(state.nodeFocusedBeforeActivation)).then(finishDeactivation, finishDeactivation);
        return this;
      }

      finishDeactivation();
      return this;
    },
    pause: function pause() {
      if (state.paused || !state.active) {
        return this;
      }

      state.paused = true;
      removeListeners();
      return this;
    },
    unpause: function unpause() {
      if (!state.paused || !state.active) {
        return this;
      }

      state.paused = false;
      updateTabbableNodes();
      addListeners();
      return this;
    },
    updateContainerElements: function updateContainerElements(containerElements) {
      var elementsAsArray = [].concat(containerElements).filter(Boolean);
      state.containers = elementsAsArray.map(function (element) {
        return typeof element === "string" ? doc.querySelector(element) : element;
      });

      if (state.active) {
        updateTabbableNodes();
      }

      return this;
    }
  };
  trap.updateContainerElements(elements);
  return trap;
}; // packages/focus/src/index.js


function src_default$2(Alpine) {
  let lastFocused;
  let currentFocused;
  window.addEventListener("focusin", () => {
    lastFocused = currentFocused;
    currentFocused = document.activeElement;
  });
  Alpine.magic("focus", el => {
    let within = el;
    return {
      __noscroll: false,
      __wrapAround: false,

      within(el2) {
        within = el2;
        return this;
      },

      withoutScrolling() {
        this.__noscroll = true;
        return this;
      },

      noscroll() {
        this.__noscroll = true;
        return this;
      },

      withWrapAround() {
        this.__wrapAround = true;
        return this;
      },

      wrap() {
        return this.withWrapAround();
      },

      focusable(el2) {
        return isFocusable(el2);
      },

      previouslyFocused() {
        return lastFocused;
      },

      lastFocused() {
        return lastFocused;
      },

      focused() {
        return currentFocused;
      },

      focusables() {
        if (Array.isArray(within)) return within;
        return focusable(within, {
          displayCheck: "none"
        });
      },

      all() {
        return this.focusables();
      },

      isFirst(el2) {
        let els = this.all();
        return els[0] && els[0].isSameNode(el2);
      },

      isLast(el2) {
        let els = this.all();
        return els.length && els.slice(-1)[0].isSameNode(el2);
      },

      getFirst() {
        return this.all()[0];
      },

      getLast() {
        return this.all().slice(-1)[0];
      },

      getNext() {
        let list = this.all();
        let current = document.activeElement;
        if (list.indexOf(current) === -1) return;

        if (this.__wrapAround && list.indexOf(current) === list.length - 1) {
          return list[0];
        }

        return list[list.indexOf(current) + 1];
      },

      getPrevious() {
        let list = this.all();
        let current = document.activeElement;
        if (list.indexOf(current) === -1) return;

        if (this.__wrapAround && list.indexOf(current) === 0) {
          return list.slice(-1)[0];
        }

        return list[list.indexOf(current) - 1];
      },

      first() {
        this.focus(this.getFirst());
      },

      last() {
        this.focus(this.getLast());
      },

      next() {
        this.focus(this.getNext());
      },

      previous() {
        this.focus(this.getPrevious());
      },

      prev() {
        return this.previous();
      },

      focus(el2) {
        if (!el2) return;
        setTimeout(() => {
          if (!el2.hasAttribute("tabindex")) el2.setAttribute("tabindex", "0");
          el2.focus({
            preventScroll: this._noscroll
          });
        });
      }

    };
  });
  Alpine.directive("trap", Alpine.skipDuringClone((el, _ref60, _ref61) => {
    let {
      expression,
      modifiers
    } = _ref60;
    let {
      effect,
      evaluateLater,
      cleanup
    } = _ref61;
    let evaluator = evaluateLater(expression);
    let oldValue = false;
    let trap = createFocusTrap(el, {
      escapeDeactivates: false,
      allowOutsideClick: true,
      fallbackFocus: () => el,
      initialFocus: el.querySelector("[autofocus]")
    });

    let undoInert = () => {};

    let undoDisableScrolling = () => {};

    const releaseFocus = () => {
      undoInert();

      undoInert = () => {};

      undoDisableScrolling();

      undoDisableScrolling = () => {};

      trap.deactivate({
        returnFocus: !modifiers.includes("noreturn")
      });
    };

    effect(() => evaluator(value => {
      if (oldValue === value) return;

      if (value && !oldValue) {
        setTimeout(() => {
          if (modifiers.includes("inert")) undoInert = setInert(el);
          if (modifiers.includes("noscroll")) undoDisableScrolling = disableScrolling();
          trap.activate();
        });
      }

      if (!value && oldValue) {
        releaseFocus();
      }

      oldValue = !!value;
    }));
    cleanup(releaseFocus);
  }, // When cloning, we only want to add aria-hidden attributes to the
  // DOM and not try to actually trap, as trapping can mess with the
  // live DOM and isn't just isolated to the cloned DOM.
  (el, _ref62, _ref63) => {
    let {
      expression,
      modifiers
    } = _ref62;
    let {
      evaluate
    } = _ref63;
    if (modifiers.includes("inert") && evaluate(expression)) setInert(el);
  }));
}

function setInert(el) {
  let undos = [];
  crawlSiblingsUp(el, sibling => {
    let cache = sibling.hasAttribute("aria-hidden");
    sibling.setAttribute("aria-hidden", "true");
    undos.push(() => cache || sibling.removeAttribute("aria-hidden"));
  });
  return () => {
    while (undos.length) undos.pop()();
  };
}

function crawlSiblingsUp(el, callback) {
  if (el.isSameNode(document.body) || !el.parentNode) return;
  Array.from(el.parentNode.children).forEach(sibling => {
    if (sibling.isSameNode(el)) {
      crawlSiblingsUp(el.parentNode, callback);
    } else {
      callback(sibling);
    }
  });
}

function disableScrolling() {
  let overflow = document.documentElement.style.overflow;
  let paddingRight = document.documentElement.style.paddingRight;
  let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
  return () => {
    document.documentElement.style.overflow = overflow;
    document.documentElement.style.paddingRight = paddingRight;
  };
} // packages/focus/builds/module.js


var module_default$2 = src_default$2;
/*! Bundled license information:

tabbable/dist/index.esm.js:
  (*!
  * tabbable 5.2.1
  * @license MIT, https://github.com/focus-trap/tabbable/blob/master/LICENSE
  *)

focus-trap/dist/focus-trap.esm.js:
  (*!
  * focus-trap 6.6.1
  * @license MIT, https://github.com/focus-trap/focus-trap/blob/master/LICENSE
  *)
*/
// packages/collapse/src/index.js

function src_default$1(Alpine) {
  Alpine.directive("collapse", collapse);

  collapse.inline = (el, _ref64) => {
    let {
      modifiers
    } = _ref64;
    if (!modifiers.includes("min")) return;

    el._x_doShow = () => {};

    el._x_doHide = () => {};
  };

  function collapse(el, _ref65) {
    let {
      modifiers
    } = _ref65;
    let duration = modifierValue(modifiers, "duration", 250) / 1e3;
    let floor = modifierValue(modifiers, "min", 0);
    let fullyHide = !modifiers.includes("min");
    if (!el._x_isShown) el.style.height = `${floor}px`;
    if (!el._x_isShown && fullyHide) el.hidden = true;
    if (!el._x_isShown) el.style.overflow = "hidden";

    let setFunction = (el2, styles) => {
      let revertFunction = Alpine.setStyles(el2, styles);
      return styles.height ? () => {} : revertFunction;
    };

    let transitionStyles = {
      transitionProperty: "height",
      transitionDuration: `${duration}s`,
      transitionTimingFunction: "cubic-bezier(0.4, 0.0, 0.2, 1)"
    };
    el._x_transition = {
      in() {
        let before = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
        let after = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
        if (fullyHide) el.hidden = false;
        if (fullyHide) el.style.display = null;
        let current = el.getBoundingClientRect().height;
        el.style.height = "auto";
        let full = el.getBoundingClientRect().height;

        if (current === full) {
          current = floor;
        }

        Alpine.transition(el, Alpine.setStyles, {
          during: transitionStyles,
          start: {
            height: current + "px"
          },
          end: {
            height: full + "px"
          }
        }, () => el._x_isShown = true, () => {
          if (el.getBoundingClientRect().height == full) {
            el.style.overflow = null;
          }
        });
      },

      out() {
        let before = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : () => {};
        let after = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : () => {};
        let full = el.getBoundingClientRect().height;
        Alpine.transition(el, setFunction, {
          during: transitionStyles,
          start: {
            height: full + "px"
          },
          end: {
            height: floor + "px"
          }
        }, () => el.style.overflow = "hidden", () => {
          el._x_isShown = false;

          if (el.style.height == `${floor}px` && fullyHide) {
            el.style.display = "none";
            el.hidden = true;
          }
        });
      }

    };
  }
}

function modifierValue(modifiers, key, fallback) {
  if (modifiers.indexOf(key) === -1) return fallback;
  const rawValue = modifiers[modifiers.indexOf(key) + 1];
  if (!rawValue) return fallback;

  if (key === "duration") {
    let match = rawValue.match(/([0-9]+)ms/);
    if (match) return match[1];
  }

  if (key === "min") {
    let match = rawValue.match(/([0-9]+)px/);
    if (match) return match[1];
  }

  return rawValue;
} // packages/collapse/builds/module.js


var module_default$1 = src_default$1; // packages/morph/src/dom.js

function createElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild;
}

function textOrComment(el) {
  return el.nodeType === 3 || el.nodeType === 8;
}

var dom = {
  replace(children, old, replacement) {
    let index = children.indexOf(old);
    if (index === -1) throw "Cant find element in children";
    old.replaceWith(replacement);
    children[index] = replacement;
    return children;
  },

  before(children, reference, subject) {
    let index = children.indexOf(reference);
    if (index === -1) throw "Cant find element in children";
    reference.before(subject);
    children.splice(index, 0, subject);
    return children;
  },

  append(children, subject, appendFn) {
    children[children.length - 1];
    appendFn(subject);
    children.push(subject);
    return children;
  },

  remove(children, subject) {
    let index = children.indexOf(subject);
    if (index === -1) throw "Cant find element in children";
    subject.remove();
    return children.filter(i => i !== subject);
  },

  first(children) {
    return this.teleportTo(children[0]);
  },

  next(children, reference) {
    let index = children.indexOf(reference);
    if (index === -1) return;
    return this.teleportTo(this.teleportBack(children[index + 1]));
  },

  teleportTo(el) {
    if (!el) return el;
    if (el._x_teleport) return el._x_teleport;
    return el;
  },

  teleportBack(el) {
    if (!el) return el;
    if (el._x_teleportBack) return el._x_teleportBack;
    return el;
  }

}; // packages/morph/src/morph.js

var resolveStep = () => {};

function morph(from, toHtml, options) {
  let toEl;
  let key, lookahead, updating, updated, removing, removed, adding, added;

  function assignOptions() {
    let options2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    let defaultGetKey = el => el.getAttribute("key");

    let noop = () => {};

    updating = options2.updating || noop;
    updated = options2.updated || noop;
    removing = options2.removing || noop;
    removed = options2.removed || noop;
    adding = options2.adding || noop;
    added = options2.added || noop;
    key = options2.key || defaultGetKey;
    lookahead = options2.lookahead || false;
  }

  function patch(from2, to) {
    if (differentElementNamesTypesOrKeys(from2, to)) {
      return patchElement(from2, to);
    }

    let updateChildrenOnly = false;
    if (shouldSkip(updating, from2, to, () => updateChildrenOnly = true)) return;
    window.Alpine && initializeAlpineOnTo(from2, to);

    if (textOrComment(to)) {
      patchNodeValue(from2, to);
      updated(from2, to);
      return;
    }

    if (!updateChildrenOnly) {
      patchAttributes(from2, to);
    }

    updated(from2, to);
    patchChildren(Array.from(from2.childNodes), Array.from(to.childNodes), toAppend => {
      from2.appendChild(toAppend);
    });
  }

  function differentElementNamesTypesOrKeys(from2, to) {
    return from2.nodeType != to.nodeType || from2.nodeName != to.nodeName || getKey(from2) != getKey(to);
  }

  function patchElement(from2, to) {
    if (shouldSkip(removing, from2)) return;
    let toCloned = to.cloneNode(true);
    if (shouldSkip(adding, toCloned)) return;
    dom.replace([from2], from2, toCloned);
    removed(from2);
    added(toCloned);
  }

  function patchNodeValue(from2, to) {
    let value = to.nodeValue;

    if (from2.nodeValue !== value) {
      from2.nodeValue = value;
    }
  }

  function patchAttributes(from2, to) {
    if (from2._x_isShown && !to._x_isShown) {
      return;
    }

    if (!from2._x_isShown && to._x_isShown) {
      return;
    }

    let domAttributes = Array.from(from2.attributes);
    let toAttributes = Array.from(to.attributes);

    for (let i = domAttributes.length - 1; i >= 0; i--) {
      let name = domAttributes[i].name;

      if (!to.hasAttribute(name)) {
        from2.removeAttribute(name);
      }
    }

    for (let i = toAttributes.length - 1; i >= 0; i--) {
      let name = toAttributes[i].name;
      let value = toAttributes[i].value;

      if (from2.getAttribute(name) !== value) {
        from2.setAttribute(name, value);
      }
    }
  }

  function patchChildren(fromChildren, toChildren, appendFn) {
    let fromKeyDomNodeMap = {};
    let fromKeyHoldovers = {};
    let currentTo = dom.first(toChildren);
    let currentFrom = dom.first(fromChildren);

    while (currentTo) {
      let toKey = getKey(currentTo);
      let fromKey = getKey(currentFrom);

      if (!currentFrom) {
        if (toKey && fromKeyHoldovers[toKey]) {
          let holdover = fromKeyHoldovers[toKey];
          fromChildren = dom.append(fromChildren, holdover, appendFn);
          currentFrom = holdover;
        } else {
          if (!shouldSkip(adding, currentTo)) {
            let clone = currentTo.cloneNode(true);
            fromChildren = dom.append(fromChildren, clone, appendFn);
            added(clone);
          }

          currentTo = dom.next(toChildren, currentTo);
          continue;
        }
      }

      let isIf = node => node.nodeType === 8 && node.textContent === " __BLOCK__ ";

      let isEnd = node => node.nodeType === 8 && node.textContent === " __ENDBLOCK__ ";

      if (isIf(currentTo) && isIf(currentFrom)) {
        let newFromChildren = [];
        let appendPoint;
        let nestedIfCount = 0;

        while (currentFrom) {
          let next = dom.next(fromChildren, currentFrom);

          if (isIf(next)) {
            nestedIfCount++;
          } else if (isEnd(next) && nestedIfCount > 0) {
            nestedIfCount--;
          } else if (isEnd(next) && nestedIfCount === 0) {
            currentFrom = dom.next(fromChildren, next);
            appendPoint = next;
            break;
          }

          newFromChildren.push(next);
          currentFrom = next;
        }

        let newToChildren = [];
        nestedIfCount = 0;

        while (currentTo) {
          let next = dom.next(toChildren, currentTo);

          if (isIf(next)) {
            nestedIfCount++;
          } else if (isEnd(next) && nestedIfCount > 0) {
            nestedIfCount--;
          } else if (isEnd(next) && nestedIfCount === 0) {
            currentTo = dom.next(toChildren, next);
            break;
          }

          newToChildren.push(next);
          currentTo = next;
        }

        patchChildren(newFromChildren, newToChildren, node => appendPoint.before(node));
        continue;
      }

      if (currentFrom.nodeType === 1 && lookahead) {
        let nextToElementSibling = dom.next(toChildren, currentTo);
        let found = false;

        while (!found && nextToElementSibling) {
          if (currentFrom.isEqualNode(nextToElementSibling)) {
            found = true;
            [fromChildren, currentFrom] = addNodeBefore(fromChildren, currentTo, currentFrom);
            fromKey = getKey(currentFrom);
          }

          nextToElementSibling = dom.next(toChildren, nextToElementSibling);
        }
      }

      if (toKey !== fromKey) {
        if (!toKey && fromKey) {
          fromKeyHoldovers[fromKey] = currentFrom;
          [fromChildren, currentFrom] = addNodeBefore(fromChildren, currentTo, currentFrom);
          fromChildren = dom.remove(fromChildren, fromKeyHoldovers[fromKey]);
          currentFrom = dom.next(fromChildren, currentFrom);
          currentTo = dom.next(toChildren, currentTo);
          continue;
        }

        if (toKey && !fromKey) {
          if (fromKeyDomNodeMap[toKey]) {
            fromChildren = dom.replace(fromChildren, currentFrom, fromKeyDomNodeMap[toKey]);
            currentFrom = fromKeyDomNodeMap[toKey];
          }
        }

        if (toKey && fromKey) {
          let fromKeyNode = fromKeyDomNodeMap[toKey];

          if (fromKeyNode) {
            fromKeyHoldovers[fromKey] = currentFrom;
            fromChildren = dom.replace(fromChildren, currentFrom, fromKeyNode);
            currentFrom = fromKeyNode;
          } else {
            fromKeyHoldovers[fromKey] = currentFrom;
            [fromChildren, currentFrom] = addNodeBefore(fromChildren, currentTo, currentFrom);
            fromChildren = dom.remove(fromChildren, fromKeyHoldovers[fromKey]);
            currentFrom = dom.next(fromChildren, currentFrom);
            currentTo = dom.next(toChildren, currentTo);
            continue;
          }
        }
      }

      let currentFromNext = currentFrom && dom.next(fromChildren, currentFrom);
      patch(currentFrom, currentTo);
      currentTo = currentTo && dom.next(toChildren, currentTo);
      currentFrom = currentFromNext;
    }

    let removals = [];

    while (currentFrom) {
      if (!shouldSkip(removing, currentFrom)) removals.push(currentFrom);
      currentFrom = dom.next(fromChildren, currentFrom);
    }

    while (removals.length) {
      let domForRemoval = removals.shift();
      domForRemoval.remove();
      removed(domForRemoval);
    }
  }

  function getKey(el) {
    return el && el.nodeType === 1 && key(el);
  }

  function addNodeBefore(children, node, beforeMe) {
    if (!shouldSkip(adding, node)) {
      let clone = node.cloneNode(true);
      children = dom.before(children, beforeMe, clone);
      added(clone);
      return [children, clone];
    }

    return [children, node];
  }

  assignOptions(options);
  toEl = typeof toHtml === "string" ? createElement(toHtml) : toHtml;

  if (window.Alpine && window.Alpine.closestDataStack && !from._x_dataStack) {
    toEl._x_dataStack = window.Alpine.closestDataStack(from);
    toEl._x_dataStack && window.Alpine.clone(from, toEl);
  }

  patch(from, toEl);
  toEl = void 0;
  return from;
}

morph.step = () => resolveStep();

morph.log = theLogger => {};

function shouldSkip(hook) {
  let skip = false;

  for (var _len6 = arguments.length, args = new Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
    args[_key6 - 1] = arguments[_key6];
  }

  hook(...args, () => skip = true);
  return skip;
}

function initializeAlpineOnTo(from, to, childrenOnly) {
  if (from.nodeType !== 1) return;

  if (from._x_dataStack) {
    window.Alpine.clone(from, to);
  }
} // packages/morph/src/index.js


function src_default(Alpine) {
  Alpine.morph = morph;
} // packages/morph/builds/module.js


var module_default = src_default;
module_default$4.plugin(module_default$3);
module_default$4.plugin(module_default$2);
module_default$4.plugin(module_default$1);
module_default$4.plugin(module_default);
window.Alpine = module_default$4;
window.Spruce = module_default$4;
module_default$4.magic('fetchedSection', () => {
  return (url, selector) => {
    return async () => {
      return await fetchSectionHTML(url, selector);
    };
  };
});
module_default$4.directive('html-with-slideshow', (el, _ref66, _ref67) => {
  let {
    expression
  } = _ref66;
  let {
    evaluateLater,
    effect,
    cleanup
  } = _ref67;
  let getHTMLString = evaluateLater(expression);
  effect(() => {
    getHTMLString(value => {
      el.innerHTML = value;

      if (value.indexOf('splide') !== -1) {
        window.discoverNewSlideshows(el);
      }
    });
  });
  cleanup(() => {
    window.destroySlideshowsIn(el);
  });
}); // document.addEventListener('DOMContentLoaded', () => {

module_default$4.start(); // });
