(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":1}],3:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],4:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":8}],5:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":25}],6:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":11}],7:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":16,"is-object":3}],8:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":14,"../vnode/is-vnode.js":17,"../vnode/is-vtext.js":18,"../vnode/is-widget.js":19,"./apply-properties":7,"global/document":2}],9:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],10:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":19,"../vnode/vpatch.js":22,"./apply-properties":7,"./update-widget":12}],11:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":8,"./dom-index":9,"./patch-op":10,"global/document":2,"x-is-array":26}],12:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":19}],13:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],14:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":15,"./is-vnode":17,"./is-vtext":18,"./is-widget":19}],15:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],16:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],17:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":20}],18:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":20}],19:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],20:[function(require,module,exports){
module.exports = "2"

},{}],21:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":15,"./is-vhook":16,"./is-vnode":17,"./is-widget":19,"./version":20}],22:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":20}],23:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":20}],24:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":16,"is-object":3}],25:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":14,"../vnode/is-thunk":15,"../vnode/is-vnode":17,"../vnode/is-vtext":18,"../vnode/is-widget":19,"../vnode/vpatch":22,"./diff-props":24,"x-is-array":26}],26:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],27:[function(require,module,exports){
// Generated by psc-bundle 0.7.6.1
var PS = { };
(function(exports) {
  /* global exports */
  "use strict";

  // module Prelude

  //- Functor --------------------------------------------------------------------

  exports.arrayMap = function (f) {
    return function (arr) {
      var l = arr.length;
      var result = new Array(l);
      for (var i = 0; i < l; i++) {
        result[i] = f(arr[i]);
      }
      return result;
    };
  };

  exports.concatArray = function (xs) {
    return function (ys) {
      return xs.concat(ys);
    };
  };

  //- Semiring -------------------------------------------------------------------

  exports.intAdd = function (x) {
    return function (y) {
      /* jshint bitwise: false */
      return x + y | 0;
    };
  };

  exports.intMul = function (x) {
    return function (y) {
      /* jshint bitwise: false */
      return x * y | 0;
    };
  };

  //- Eq -------------------------------------------------------------------------

  exports.refEq = function (r1) {
    return function (r2) {
      return r1 === r2;
    };
  };

  exports.eqArrayImpl = function (f) {
    return function (xs) {
      return function (ys) {
        if (xs.length !== ys.length) return false;
        for (var i = 0; i < xs.length; i++) {
          if (!f(xs[i])(ys[i])) return false;
        }
        return true;
      };
    };
  };

  //- Ord ------------------------------------------------------------------------

  exports.unsafeCompareImpl = function (lt) {
    return function (eq) {
      return function (gt) {
        return function (x) {
          return function (y) {
            return x < y ? lt : x > y ? gt : eq;
          };
        };
      };
    };
  };

  //- Bounded --------------------------------------------------------------------

  exports.topInt = 2147483647;
  exports.bottomInt = -2147483648;            

  //- BooleanAlgebra -------------------------------------------------------------

  exports.boolOr = function (b1) {
    return function (b2) {
      return b1 || b2;
    };
  };

  exports.boolAnd = function (b1) {
    return function (b2) {
      return b1 && b2;
    };
  };

  exports.boolNot = function (b) {
    return !b;
  };

  //- Show -----------------------------------------------------------------------

  exports.showIntImpl = function (n) {
    return n.toString();
  };
 
})(PS["Prelude"] = PS["Prelude"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Prelude"];
  var LT = (function () {
      function LT() {

      };
      LT.value = new LT();
      return LT;
  })();
  var GT = (function () {
      function GT() {

      };
      GT.value = new GT();
      return GT;
  })();
  var EQ = (function () {
      function EQ() {

      };
      EQ.value = new EQ();
      return EQ;
  })();
  var Semigroupoid = function (compose) {
      this.compose = compose;
  };
  var Category = function (__superclass_Prelude$dotSemigroupoid_0, id) {
      this["__superclass_Prelude.Semigroupoid_0"] = __superclass_Prelude$dotSemigroupoid_0;
      this.id = id;
  };
  var Functor = function (map) {
      this.map = map;
  };
  var Apply = function (__superclass_Prelude$dotFunctor_0, apply) {
      this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
      this.apply = apply;
  };
  var Applicative = function (__superclass_Prelude$dotApply_0, pure) {
      this["__superclass_Prelude.Apply_0"] = __superclass_Prelude$dotApply_0;
      this.pure = pure;
  };
  var Bind = function (__superclass_Prelude$dotApply_0, bind) {
      this["__superclass_Prelude.Apply_0"] = __superclass_Prelude$dotApply_0;
      this.bind = bind;
  };
  var Monad = function (__superclass_Prelude$dotApplicative_0, __superclass_Prelude$dotBind_1) {
      this["__superclass_Prelude.Applicative_0"] = __superclass_Prelude$dotApplicative_0;
      this["__superclass_Prelude.Bind_1"] = __superclass_Prelude$dotBind_1;
  };
  var Semigroup = function (append) {
      this.append = append;
  };
  var Semiring = function (add, mul, one, zero) {
      this.add = add;
      this.mul = mul;
      this.one = one;
      this.zero = zero;
  };
  var Eq = function (eq) {
      this.eq = eq;
  };
  var Ord = function (__superclass_Prelude$dotEq_0, compare) {
      this["__superclass_Prelude.Eq_0"] = __superclass_Prelude$dotEq_0;
      this.compare = compare;
  };
  var Bounded = function (bottom, top) {
      this.bottom = bottom;
      this.top = top;
  };
  var BooleanAlgebra = function (__superclass_Prelude$dotBounded_0, conj, disj, not) {
      this["__superclass_Prelude.Bounded_0"] = __superclass_Prelude$dotBounded_0;
      this.conj = conj;
      this.disj = disj;
      this.not = not;
  };
  var Show = function (show) {
      this.show = show;
  };
  var zero = function (dict) {
      return dict.zero;
  };
  var unsafeCompare = $foreign.unsafeCompareImpl(LT.value)(EQ.value)(GT.value);
  var unit = {};
  var top = function (dict) {
      return dict.top;
  };                                                 
  var showInt = new Show($foreign.showIntImpl);
  var show = function (dict) {
      return dict.show;
  };                                                                            
  var semiringInt = new Semiring($foreign.intAdd, $foreign.intMul, 1, 0);
  var semigroupoidFn = new Semigroupoid(function (f) {
      return function (g) {
          return function (x) {
              return f(g(x));
          };
      };
  });
  var semigroupArray = new Semigroup($foreign.concatArray);
  var pure = function (dict) {
      return dict.pure;
  };
  var $$return = function (__dict_Applicative_2) {
      return pure(__dict_Applicative_2);
  };
  var otherwise = true;
  var one = function (dict) {
      return dict.one;
  };
  var not = function (dict) {
      return dict.not;
  };
  var mul = function (dict) {
      return dict.mul;
  };
  var map = function (dict) {
      return dict.map;
  };
  var $less$dollar$greater = function (__dict_Functor_5) {
      return map(__dict_Functor_5);
  };
  var id = function (dict) {
      return dict.id;
  };
  var functorArray = new Functor($foreign.arrayMap);
  var flip = function (f) {
      return function (b) {
          return function (a) {
              return f(a)(b);
          };
      };
  }; 
  var eqString = new Eq($foreign.refEq);
  var eqInt = new Eq($foreign.refEq);
  var ordInt = new Ord(function () {
      return eqInt;
  }, unsafeCompare);
  var eqChar = new Eq($foreign.refEq);
  var eqBoolean = new Eq($foreign.refEq);
  var eq = function (dict) {
      return dict.eq;
  };
  var $eq$eq = function (__dict_Eq_7) {
      return eq(__dict_Eq_7);
  };
  var eqArray = function (__dict_Eq_8) {
      return new Eq($foreign.eqArrayImpl($eq$eq(__dict_Eq_8)));
  };
  var disj = function (dict) {
      return dict.disj;
  };
  var $$const = function (a) {
      return function (_3) {
          return a;
      };
  };
  var conj = function (dict) {
      return dict.conj;
  };
  var compose = function (dict) {
      return dict.compose;
  };
  var $greater$greater$greater = function (__dict_Semigroupoid_15) {
      return flip(compose(__dict_Semigroupoid_15));
  };
  var compare = function (dict) {
      return dict.compare;
  };
  var categoryFn = new Category(function () {
      return semigroupoidFn;
  }, function (x) {
      return x;
  });
  var boundedInt = new Bounded($foreign.bottomInt, $foreign.topInt);
  var boundedBoolean = new Bounded(false, true);
  var bottom = function (dict) {
      return dict.bottom;
  };
  var booleanAlgebraBoolean = new BooleanAlgebra(function () {
      return boundedBoolean;
  }, $foreign.boolAnd, $foreign.boolOr, $foreign.boolNot);
  var bind = function (dict) {
      return dict.bind;
  };
  var liftM1 = function (__dict_Monad_23) {
      return function (f) {
          return function (a) {
              return bind(__dict_Monad_23["__superclass_Prelude.Bind_1"]())(a)(function (_0) {
                  return $$return(__dict_Monad_23["__superclass_Prelude.Applicative_0"]())(f(_0));
              });
          };
      };
  };
  var $greater$greater$eq = function (__dict_Bind_24) {
      return bind(__dict_Bind_24);
  }; 
  var apply = function (dict) {
      return dict.apply;
  };
  var $less$times$greater = function (__dict_Apply_25) {
      return apply(__dict_Apply_25);
  };
  var liftA1 = function (__dict_Applicative_26) {
      return function (f) {
          return function (a) {
              return $less$times$greater(__dict_Applicative_26["__superclass_Prelude.Apply_0"]())(pure(__dict_Applicative_26)(f))(a);
          };
      };
  }; 
  var append = function (dict) {
      return dict.append;
  };
  var $plus$plus = function (__dict_Semigroup_27) {
      return append(__dict_Semigroup_27);
  };
  var $less$greater = function (__dict_Semigroup_28) {
      return append(__dict_Semigroup_28);
  };
  var ap = function (__dict_Monad_30) {
      return function (f) {
          return function (a) {
              return bind(__dict_Monad_30["__superclass_Prelude.Bind_1"]())(f)(function (_2) {
                  return bind(__dict_Monad_30["__superclass_Prelude.Bind_1"]())(a)(function (_1) {
                      return $$return(__dict_Monad_30["__superclass_Prelude.Applicative_0"]())(_2(_1));
                  });
              });
          };
      };
  }; 
  var add = function (dict) {
      return dict.add;
  };
  var $plus = function (__dict_Semiring_31) {
      return add(__dict_Semiring_31);
  };
  exports["LT"] = LT;
  exports["GT"] = GT;
  exports["EQ"] = EQ;
  exports["Show"] = Show;
  exports["BooleanAlgebra"] = BooleanAlgebra;
  exports["Bounded"] = Bounded;
  exports["Ord"] = Ord;
  exports["Eq"] = Eq;
  exports["Semiring"] = Semiring;
  exports["Semigroup"] = Semigroup;
  exports["Monad"] = Monad;
  exports["Bind"] = Bind;
  exports["Applicative"] = Applicative;
  exports["Apply"] = Apply;
  exports["Functor"] = Functor;
  exports["Category"] = Category;
  exports["Semigroupoid"] = Semigroupoid;
  exports["show"] = show;
  exports["not"] = not;
  exports["disj"] = disj;
  exports["conj"] = conj;
  exports["bottom"] = bottom;
  exports["top"] = top;
  exports["unsafeCompare"] = unsafeCompare;
  exports["compare"] = compare;
  exports["=="] = $eq$eq;
  exports["eq"] = eq;
  exports["+"] = $plus;
  exports["one"] = one;
  exports["mul"] = mul;
  exports["zero"] = zero;
  exports["add"] = add;
  exports["++"] = $plus$plus;
  exports["<>"] = $less$greater;
  exports["append"] = append;
  exports["ap"] = ap;
  exports["liftM1"] = liftM1;
  exports["return"] = $$return;
  exports[">>="] = $greater$greater$eq;
  exports["bind"] = bind;
  exports["liftA1"] = liftA1;
  exports["pure"] = pure;
  exports["<*>"] = $less$times$greater;
  exports["apply"] = apply;
  exports["<$>"] = $less$dollar$greater;
  exports["map"] = map;
  exports["id"] = id;
  exports[">>>"] = $greater$greater$greater;
  exports["compose"] = compose;
  exports["otherwise"] = otherwise;
  exports["const"] = $$const;
  exports["flip"] = flip;
  exports["unit"] = unit;
  exports["semigroupoidFn"] = semigroupoidFn;
  exports["categoryFn"] = categoryFn;
  exports["functorArray"] = functorArray;
  exports["semigroupArray"] = semigroupArray;
  exports["semiringInt"] = semiringInt;
  exports["eqBoolean"] = eqBoolean;
  exports["eqInt"] = eqInt;
  exports["eqChar"] = eqChar;
  exports["eqString"] = eqString;
  exports["eqArray"] = eqArray;
  exports["ordInt"] = ordInt;
  exports["boundedBoolean"] = boundedBoolean;
  exports["boundedInt"] = boundedInt;
  exports["booleanAlgebraBoolean"] = booleanAlgebraBoolean;
  exports["showInt"] = showInt;;
 
})(PS["Prelude"] = PS["Prelude"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];     
  var Alt = function (__superclass_Prelude$dotFunctor_0, alt) {
      this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
      this.alt = alt;
  };                                         
  var alt = function (dict) {
      return dict.alt;
  };
  exports["Alt"] = Alt;
  exports["alt"] = alt;;
 
})(PS["Control.Alt"] = PS["Control.Alt"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var $times$greater = function (__dict_Apply_1) {
      return function (a) {
          return function (b) {
              return Prelude["<*>"](__dict_Apply_1)(Prelude["<$>"](__dict_Apply_1["__superclass_Prelude.Functor_0"]())(Prelude["const"](Prelude.id(Prelude.categoryFn)))(a))(b);
          };
      };
  };
  exports["*>"] = $times$greater;;
 
})(PS["Control.Apply"] = PS["Control.Apply"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var $eq$less$less = function (__dict_Bind_1) {
      return function (f) {
          return function (m) {
              return Prelude[">>="](__dict_Bind_1)(m)(f);
          };
      };
  };
  var $less$eq$less = function (__dict_Bind_2) {
      return function (f) {
          return function (g) {
              return function (a) {
                  return $eq$less$less(__dict_Bind_2)(f)(g(a));
              };
          };
      };
  };
  exports["<=<"] = $less$eq$less;
  exports["=<<"] = $eq$less$less;;
 
})(PS["Control.Bind"] = PS["Control.Bind"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];     
  var Plus = function (__superclass_Control$dotAlt$dotAlt_0, empty) {
      this["__superclass_Control.Alt.Alt_0"] = __superclass_Control$dotAlt$dotAlt_0;
      this.empty = empty;
  };       
  var empty = function (dict) {
      return dict.empty;
  };
  exports["Plus"] = Plus;
  exports["empty"] = empty;;
 
})(PS["Control.Plus"] = PS["Control.Plus"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];     
  var Monoid = function (__superclass_Prelude$dotSemigroup_0, mempty) {
      this["__superclass_Prelude.Semigroup_0"] = __superclass_Prelude$dotSemigroup_0;
      this.mempty = mempty;
  };     
  var monoidArray = new Monoid(function () {
      return Prelude.semigroupArray;
  }, [  ]);
  var mempty = function (dict) {
      return dict.mempty;
  };
  exports["Monoid"] = Monoid;
  exports["mempty"] = mempty;
  exports["monoidArray"] = monoidArray;;
 
})(PS["Data.Monoid"] = PS["Data.Monoid"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Extend = PS["Control.Extend"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];     
  var Nothing = (function () {
      function Nothing() {

      };
      Nothing.value = new Nothing();
      return Nothing;
  })();
  var Just = (function () {
      function Just(value0) {
          this.value0 = value0;
      };
      Just.create = function (value0) {
          return new Just(value0);
      };
      return Just;
  })();
  var maybe = function (b) {
      return function (f) {
          return function (_0) {
              if (_0 instanceof Nothing) {
                  return b;
              };
              if (_0 instanceof Just) {
                  return f(_0.value0);
              };
              throw new Error("Failed pattern match at Data.Maybe line 26, column 1 - line 27, column 1: " + [ b.constructor.name, f.constructor.name, _0.constructor.name ]);
          };
      };
  };                                                
  var functorMaybe = new Prelude.Functor(function (fn) {
      return function (_2) {
          if (_2 instanceof Just) {
              return new Just(fn(_2.value0));
          };
          return Nothing.value;
      };
  });
  var fromMaybe = function (a) {
      return maybe(a)(Prelude.id(Prelude.categoryFn));
  };
  exports["Nothing"] = Nothing;
  exports["Just"] = Just;
  exports["fromMaybe"] = fromMaybe;
  exports["maybe"] = maybe;
  exports["functorMaybe"] = functorMaybe;;
 
})(PS["Data.Maybe"] = PS["Data.Maybe"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];     
  var Bifunctor = function (bimap) {
      this.bimap = bimap;
  };
  var bimap = function (dict) {
      return dict.bimap;
  };
  var rmap = function (__dict_Bifunctor_1) {
      return bimap(__dict_Bifunctor_1)(Prelude.id(Prelude.categoryFn));
  };
  exports["Bifunctor"] = Bifunctor;
  exports["rmap"] = rmap;
  exports["bimap"] = bimap;;
 
})(PS["Data.Bifunctor"] = PS["Data.Bifunctor"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Foldable

  exports.foldrArray = function (f) {
    return function (init) {
      return function (xs) {
        var acc = init;
        var len = xs.length;
        for (var i = len - 1; i >= 0; i--) {
          acc = f(xs[i])(acc);
        }
        return acc;
      };
    };
  };

  exports.foldlArray = function (f) {
    return function (init) {
      return function (xs) {
        var acc = init;
        var len = xs.length;
        for (var i = 0; i < len; i++) {
          acc = f(acc)(xs[i]);
        }
        return acc;
      };
    };
  };
 
})(PS["Data.Foldable"] = PS["Data.Foldable"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Data_Monoid = PS["Data.Monoid"];     
  var Conj = function (x) {
      return x;
  };
  var semigroupConj = function (__dict_BooleanAlgebra_2) {
      return new Prelude.Semigroup(function (_10) {
          return function (_11) {
              return Prelude.conj(__dict_BooleanAlgebra_2)(_10)(_11);
          };
      });
  };
  var runConj = function (_0) {
      return _0;
  };
  var monoidConj = function (__dict_BooleanAlgebra_4) {
      return new Data_Monoid.Monoid(function () {
          return semigroupConj(__dict_BooleanAlgebra_4);
      }, Prelude.top(__dict_BooleanAlgebra_4["__superclass_Prelude.Bounded_0"]()));
  };
  exports["Conj"] = Conj;
  exports["runConj"] = runConj;
  exports["semigroupConj"] = semigroupConj;
  exports["monoidConj"] = monoidConj;;
 
})(PS["Data.Monoid.Conj"] = PS["Data.Monoid.Conj"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Data_Monoid = PS["Data.Monoid"];     
  var Disj = function (x) {
      return x;
  };
  var semigroupDisj = function (__dict_BooleanAlgebra_2) {
      return new Prelude.Semigroup(function (_10) {
          return function (_11) {
              return Prelude.disj(__dict_BooleanAlgebra_2)(_10)(_11);
          };
      });
  };
  var runDisj = function (_0) {
      return _0;
  };
  var monoidDisj = function (__dict_BooleanAlgebra_4) {
      return new Data_Monoid.Monoid(function () {
          return semigroupDisj(__dict_BooleanAlgebra_4);
      }, Prelude.bottom(__dict_BooleanAlgebra_4["__superclass_Prelude.Bounded_0"]()));
  };
  exports["Disj"] = Disj;
  exports["runDisj"] = runDisj;
  exports["semigroupDisj"] = semigroupDisj;
  exports["monoidDisj"] = monoidDisj;;
 
})(PS["Data.Monoid.Disj"] = PS["Data.Monoid.Disj"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Foldable"];
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Maybe_Last = PS["Data.Maybe.Last"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Monoid_Additive = PS["Data.Monoid.Additive"];
  var Data_Monoid_Conj = PS["Data.Monoid.Conj"];
  var Data_Monoid_Disj = PS["Data.Monoid.Disj"];
  var Data_Monoid_Dual = PS["Data.Monoid.Dual"];
  var Data_Monoid_Endo = PS["Data.Monoid.Endo"];
  var Data_Monoid_Multiplicative = PS["Data.Monoid.Multiplicative"];     
  var Foldable = function (foldMap, foldl, foldr) {
      this.foldMap = foldMap;
      this.foldl = foldl;
      this.foldr = foldr;
  };
  var foldr = function (dict) {
      return dict.foldr;
  };
  var traverse_ = function (__dict_Applicative_0) {
      return function (__dict_Foldable_1) {
          return function (f) {
              return foldr(__dict_Foldable_1)(function (_109) {
                  return Control_Apply["*>"](__dict_Applicative_0["__superclass_Prelude.Apply_0"]())(f(_109));
              })(Prelude.pure(__dict_Applicative_0)(Prelude.unit));
          };
      };
  };
  var for_ = function (__dict_Applicative_2) {
      return function (__dict_Foldable_3) {
          return Prelude.flip(traverse_(__dict_Applicative_2)(__dict_Foldable_3));
      };
  };
  var foldl = function (dict) {
      return dict.foldl;
  };
  var sum = function (__dict_Foldable_18) {
      return function (__dict_Semiring_19) {
          return foldl(__dict_Foldable_18)(Prelude["+"](__dict_Semiring_19))(Prelude.zero(__dict_Semiring_19));
      };
  }; 
  var foldMapDefaultR = function (__dict_Foldable_26) {
      return function (__dict_Monoid_27) {
          return function (f) {
              return function (xs) {
                  return foldr(__dict_Foldable_26)(function (x) {
                      return function (acc) {
                          return Prelude["<>"](__dict_Monoid_27["__superclass_Prelude.Semigroup_0"]())(f(x))(acc);
                      };
                  })(Data_Monoid.mempty(__dict_Monoid_27))(xs);
              };
          };
      };
  };
  var foldableArray = new Foldable(function (__dict_Monoid_28) {
      return foldMapDefaultR(foldableArray)(__dict_Monoid_28);
  }, $foreign.foldlArray, $foreign.foldrArray);
  var foldMap = function (dict) {
      return dict.foldMap;
  };
  var any = function (__dict_Foldable_38) {
      return function (__dict_BooleanAlgebra_39) {
          return function (p) {
              return function (_112) {
                  return Data_Monoid_Disj.runDisj(foldMap(__dict_Foldable_38)(Data_Monoid_Disj.monoidDisj(__dict_BooleanAlgebra_39))(function (_113) {
                      return Data_Monoid_Disj.Disj(p(_113));
                  })(_112));
              };
          };
      };
  };
  var elem = function (__dict_Foldable_40) {
      return function (__dict_Eq_41) {
          return function (_114) {
              return any(__dict_Foldable_40)(Prelude.booleanAlgebraBoolean)(Prelude["=="](__dict_Eq_41)(_114));
          };
      };
  };
  var all = function (__dict_Foldable_46) {
      return function (__dict_BooleanAlgebra_47) {
          return function (p) {
              return function (_116) {
                  return Data_Monoid_Conj.runConj(foldMap(__dict_Foldable_46)(Data_Monoid_Conj.monoidConj(__dict_BooleanAlgebra_47))(function (_117) {
                      return Data_Monoid_Conj.Conj(p(_117));
                  })(_116));
              };
          };
      };
  };
  exports["Foldable"] = Foldable;
  exports["elem"] = elem;
  exports["sum"] = sum;
  exports["all"] = all;
  exports["any"] = any;
  exports["for_"] = for_;
  exports["traverse_"] = traverse_;
  exports["foldMapDefaultR"] = foldMapDefaultR;
  exports["foldMap"] = foldMap;
  exports["foldl"] = foldl;
  exports["foldr"] = foldr;
  exports["foldableArray"] = foldableArray;;
 
})(PS["Data.Foldable"] = PS["Data.Foldable"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Traversable

  // jshint maxparams: 3

  exports.traverseArrayImpl = function () {
    function Cont (fn) {
      this.fn = fn;
    }

    var emptyList = {};

    var ConsCell = function (head, tail) {
      this.head = head;
      this.tail = tail;
    };

    function consList (x) {
      return function (xs) {
        return new ConsCell(x, xs);
      };
    }

    function listToArray (list) {
      var arr = [];
      while (list !== emptyList) {
        arr.push(list.head);
        list = list.tail;
      }
      return arr;
    }

    return function (apply) {
      return function (map) {
        return function (pure) {
          return function (f) {
            var buildFrom = function (x, ys) {
              return apply(map(consList)(f(x)))(ys);
            };

            var go = function (acc, currentLen, xs) {
              if (currentLen === 0) {
                return acc;
              } else {
                var last = xs[currentLen - 1];
                return new Cont(function () {
                  return go(buildFrom(last, acc), currentLen - 1, xs);
                });
              }
            };

            return function (array) {
              var result = go(pure(emptyList), array.length, array);
              while (result instanceof Cont) {
                result = result.fn();
              }

              return map(listToArray)(result);
            };
          };
        };
      };
    };
  }();
 
})(PS["Data.Traversable"] = PS["Data.Traversable"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Traversable"];
  var Prelude = PS["Prelude"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Maybe_Last = PS["Data.Maybe.Last"];
  var Data_Monoid_Additive = PS["Data.Monoid.Additive"];
  var Data_Monoid_Conj = PS["Data.Monoid.Conj"];
  var Data_Monoid_Disj = PS["Data.Monoid.Disj"];
  var Data_Monoid_Dual = PS["Data.Monoid.Dual"];
  var Data_Monoid_Multiplicative = PS["Data.Monoid.Multiplicative"];
  var Traversable = function (__superclass_Data$dotFoldable$dotFoldable_1, __superclass_Prelude$dotFunctor_0, sequence, traverse) {
      this["__superclass_Data.Foldable.Foldable_1"] = __superclass_Data$dotFoldable$dotFoldable_1;
      this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
      this.sequence = sequence;
      this.traverse = traverse;
  };
  var traverse = function (dict) {
      return dict.traverse;
  };
  var sequenceDefault = function (__dict_Traversable_12) {
      return function (__dict_Applicative_13) {
          return function (tma) {
              return traverse(__dict_Traversable_12)(__dict_Applicative_13)(Prelude.id(Prelude.categoryFn))(tma);
          };
      };
  };
  var traversableArray = new Traversable(function () {
      return Data_Foldable.foldableArray;
  }, function () {
      return Prelude.functorArray;
  }, function (__dict_Applicative_15) {
      return sequenceDefault(traversableArray)(__dict_Applicative_15);
  }, function (__dict_Applicative_14) {
      return $foreign.traverseArrayImpl(Prelude.apply(__dict_Applicative_14["__superclass_Prelude.Apply_0"]()))(Prelude.map((__dict_Applicative_14["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]()))(Prelude.pure(__dict_Applicative_14));
  });
  var sequence = function (dict) {
      return dict.sequence;
  };
  exports["Traversable"] = Traversable;
  exports["sequenceDefault"] = sequenceDefault;
  exports["sequence"] = sequence;
  exports["traverse"] = traverse;
  exports["traversableArray"] = traversableArray;;
 
})(PS["Data.Traversable"] = PS["Data.Traversable"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Biapplicative = PS["Control.Biapplicative"];
  var Control_Biapply = PS["Control.Biapply"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Control_Lazy = PS["Control.Lazy"];
  var Data_Bifoldable = PS["Data.Bifoldable"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Bitraversable = PS["Data.Bitraversable"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_First = PS["Data.Maybe.First"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];     
  var Tuple = (function () {
      function Tuple(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Tuple.create = function (value0) {
          return function (value1) {
              return new Tuple(value0, value1);
          };
      };
      return Tuple;
  })();
  exports["Tuple"] = Tuple;;
 
})(PS["Data.Tuple"] = PS["Data.Tuple"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Extend = PS["Control.Extend"];
  var Data_Bifoldable = PS["Data.Bifoldable"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Bitraversable = PS["Data.Bitraversable"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];     
  var Left = (function () {
      function Left(value0) {
          this.value0 = value0;
      };
      Left.create = function (value0) {
          return new Left(value0);
      };
      return Left;
  })();
  var Right = (function () {
      function Right(value0) {
          this.value0 = value0;
      };
      Right.create = function (value0) {
          return new Right(value0);
      };
      return Right;
  })();
  var functorEither = new Prelude.Functor(function (f) {
      return function (_2) {
          if (_2 instanceof Left) {
              return new Left(_2.value0);
          };
          if (_2 instanceof Right) {
              return new Right(f(_2.value0));
          };
          throw new Error("Failed pattern match at Data.Either line 52, column 1 - line 56, column 1: " + [ f.constructor.name, _2.constructor.name ]);
      };
  });
  var either = function (f) {
      return function (g) {
          return function (_1) {
              if (_1 instanceof Left) {
                  return f(_1.value0);
              };
              if (_1 instanceof Right) {
                  return g(_1.value0);
              };
              throw new Error("Failed pattern match at Data.Either line 28, column 1 - line 29, column 1: " + [ f.constructor.name, g.constructor.name, _1.constructor.name ]);
          };
      };
  };
  var bifunctorEither = new Data_Bifunctor.Bifunctor(function (f) {
      return function (g) {
          return function (_3) {
              if (_3 instanceof Left) {
                  return new Left(f(_3.value0));
              };
              if (_3 instanceof Right) {
                  return new Right(g(_3.value0));
              };
              throw new Error("Failed pattern match at Data.Either line 56, column 1 - line 92, column 1: " + [ f.constructor.name, g.constructor.name, _3.constructor.name ]);
          };
      };
  });
  var applyEither = new Prelude.Apply(function () {
      return functorEither;
  }, function (_4) {
      return function (r) {
          if (_4 instanceof Left) {
              return new Left(_4.value0);
          };
          if (_4 instanceof Right) {
              return Prelude["<$>"](functorEither)(_4.value0)(r);
          };
          throw new Error("Failed pattern match at Data.Either line 92, column 1 - line 116, column 1: " + [ _4.constructor.name, r.constructor.name ]);
      };
  });
  exports["Left"] = Left;
  exports["Right"] = Right;
  exports["either"] = either;
  exports["functorEither"] = functorEither;
  exports["bifunctorEither"] = bifunctorEither;
  exports["applyEither"] = applyEither;;
 
})(PS["Data.Either"] = PS["Data.Either"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Comonad = PS["Control.Comonad"];
  var Control_Extend = PS["Control.Extend"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];     
  var Identity = function (x) {
      return x;
  };
  var runIdentity = function (_0) {
      return _0;
  };
  var functorIdentity = new Prelude.Functor(function (f) {
      return function (_23) {
          return f(_23);
      };
  });
  var applyIdentity = new Prelude.Apply(function () {
      return functorIdentity;
  }, function (_24) {
      return function (_25) {
          return _24(_25);
      };
  });
  var bindIdentity = new Prelude.Bind(function () {
      return applyIdentity;
  }, function (_26) {
      return function (f) {
          return f(_26);
      };
  });
  var applicativeIdentity = new Prelude.Applicative(function () {
      return applyIdentity;
  }, Identity);
  var monadIdentity = new Prelude.Monad(function () {
      return applicativeIdentity;
  }, function () {
      return bindIdentity;
  });
  exports["Identity"] = Identity;
  exports["runIdentity"] = runIdentity;
  exports["functorIdentity"] = functorIdentity;
  exports["applyIdentity"] = applyIdentity;
  exports["applicativeIdentity"] = applicativeIdentity;
  exports["bindIdentity"] = bindIdentity;
  exports["monadIdentity"] = monadIdentity;;
 
})(PS["Data.Identity"] = PS["Data.Identity"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];     
  var $less$dollar = function (__dict_Functor_0) {
      return function (x) {
          return function (f) {
              return Prelude["<$>"](__dict_Functor_0)(Prelude["const"](x))(f);
          };
      };
  };
  var $dollar$greater = function (__dict_Functor_1) {
      return function (f) {
          return function (x) {
              return Prelude["<$>"](__dict_Functor_1)(Prelude["const"](x))(f);
          };
      };
  };
  exports["$>"] = $dollar$greater;
  exports["<$"] = $less$dollar;;
 
})(PS["Data.Functor"] = PS["Data.Functor"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];     
  var Profunctor = function (dimap) {
      this.dimap = dimap;
  };
  var profunctorFn = new Profunctor(function (a2b) {
      return function (c2d) {
          return function (b2c) {
              return Prelude[">>>"](Prelude.semigroupoidFn)(a2b)(Prelude[">>>"](Prelude.semigroupoidFn)(b2c)(c2d));
          };
      };
  });
  var dimap = function (dict) {
      return dict.dimap;
  };
  var rmap = function (__dict_Profunctor_1) {
      return function (b2c) {
          return dimap(__dict_Profunctor_1)(Prelude.id(Prelude.categoryFn))(b2c);
      };
  };
  exports["Profunctor"] = Profunctor;
  exports["rmap"] = rmap;
  exports["dimap"] = dimap;
  exports["profunctorFn"] = profunctorFn;;
 
})(PS["Data.Profunctor"] = PS["Data.Profunctor"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];     
  var MonadTrans = function (lift) {
      this.lift = lift;
  };
  var lift = function (dict) {
      return dict.lift;
  };
  exports["MonadTrans"] = MonadTrans;
  exports["lift"] = lift;;
 
})(PS["Control.Monad.Trans"] = PS["Control.Monad.Trans"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Exists

  exports.mkExists = function (fa) {
    return fa;
  };

  exports.runExists = function (f) {
    return function (fa) {
      return f(fa);
    };
  };
 
})(PS["Data.Exists"] = PS["Data.Exists"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Exists"];
  var Prelude = PS["Prelude"];
  exports["runExists"] = $foreign.runExists;
  exports["mkExists"] = $foreign.mkExists;;
 
})(PS["Data.Exists"] = PS["Data.Exists"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Control.Monad.Eff

  exports.returnE = function (a) {
    return function () {
      return a;
    };
  };

  exports.bindE = function (a) {
    return function (f) {
      return function () {
        return f(a())();
      };
    };
  };
 
})(PS["Control.Monad.Eff"] = PS["Control.Monad.Eff"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Control.Monad.Eff"];
  var Prelude = PS["Prelude"];     
  var monadEff = new Prelude.Monad(function () {
      return applicativeEff;
  }, function () {
      return bindEff;
  });
  var bindEff = new Prelude.Bind(function () {
      return applyEff;
  }, $foreign.bindE);
  var applyEff = new Prelude.Apply(function () {
      return functorEff;
  }, Prelude.ap(monadEff));
  var applicativeEff = new Prelude.Applicative(function () {
      return applyEff;
  }, $foreign.returnE);
  var functorEff = new Prelude.Functor(Prelude.liftA1(applicativeEff));
  exports["functorEff"] = functorEff;
  exports["applyEff"] = applyEff;
  exports["applicativeEff"] = applicativeEff;
  exports["bindEff"] = bindEff;
  exports["monadEff"] = monadEff;;
 
})(PS["Control.Monad.Eff"] = PS["Control.Monad.Eff"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_ST = PS["Control.Monad.ST"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Monad_Eff_Unsafe = PS["Control.Monad.Eff.Unsafe"];
  var Data_Either_Unsafe = PS["Data.Either.Unsafe"];     
  var MonadRec = function (__superclass_Prelude$dotMonad_0, tailRecM) {
      this["__superclass_Prelude.Monad_0"] = __superclass_Prelude$dotMonad_0;
      this.tailRecM = tailRecM;
  };
  var tailRecM = function (dict) {
      return dict.tailRecM;
  };             
  var forever = function (__dict_MonadRec_2) {
      return function (ma) {
          return tailRecM(__dict_MonadRec_2)(function (u) {
              return Data_Functor["<$"]((((__dict_MonadRec_2["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(new Data_Either.Left(u))(ma);
          })(Prelude.unit);
      };
  };
  exports["MonadRec"] = MonadRec;
  exports["forever"] = forever;
  exports["tailRecM"] = tailRecM;;
 
})(PS["Control.Monad.Rec.Class"] = PS["Control.Monad.Rec.Class"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Exists = PS["Data.Exists"];
  var Data_Either = PS["Data.Either"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];     
  var Bound = (function () {
      function Bound(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Bound.create = function (value0) {
          return function (value1) {
              return new Bound(value0, value1);
          };
      };
      return Bound;
  })();
  var FreeT = (function () {
      function FreeT(value0) {
          this.value0 = value0;
      };
      FreeT.create = function (value0) {
          return new FreeT(value0);
      };
      return FreeT;
  })();
  var Bind = (function () {
      function Bind(value0) {
          this.value0 = value0;
      };
      Bind.create = function (value0) {
          return new Bind(value0);
      };
      return Bind;
  })();
  var monadTransFreeT = function (__dict_Functor_4) {
      return new Control_Monad_Trans.MonadTrans(function (__dict_Monad_5) {
          return function (ma) {
              return new FreeT(function (_11) {
                  return Prelude.map(((__dict_Monad_5["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Either.Left.create)(ma);
              });
          };
      });
  };
  var freeT = FreeT.create;
  var bound = function (m) {
      return function (f) {
          return new Bind(Data_Exists.mkExists(new Bound(m, f)));
      };
  };
  var functorFreeT = function (__dict_Functor_12) {
      return function (__dict_Functor_13) {
          return new Prelude.Functor(function (f) {
              return function (_17) {
                  if (_17 instanceof FreeT) {
                      return new FreeT(function (_5) {
                          return Prelude.map(__dict_Functor_13)(Data_Bifunctor.bimap(Data_Either.bifunctorEither)(f)(Prelude.map(__dict_Functor_12)(Prelude.map(functorFreeT(__dict_Functor_12)(__dict_Functor_13))(f))))(_17.value0(Prelude.unit));
                      });
                  };
                  if (_17 instanceof Bind) {
                      return Data_Exists.runExists(function (_6) {
                          return bound(_6.value0)(function (_72) {
                              return Prelude.map(functorFreeT(__dict_Functor_12)(__dict_Functor_13))(f)(_6.value1(_72));
                          });
                      })(_17.value0);
                  };
                  throw new Error("Failed pattern match: " + [ f.constructor.name, _17.constructor.name ]);
              };
          });
      };
  };
  var bimapFreeT = function (__dict_Functor_16) {
      return function (__dict_Functor_17) {
          return function (nf) {
              return function (nm) {
                  return function (_15) {
                      if (_15 instanceof Bind) {
                          return Data_Exists.runExists(function (_13) {
                              return bound(function (_73) {
                                  return bimapFreeT(__dict_Functor_16)(__dict_Functor_17)(nf)(nm)(_13.value0(_73));
                              })(function (_74) {
                                  return bimapFreeT(__dict_Functor_16)(__dict_Functor_17)(nf)(nm)(_13.value1(_74));
                              });
                          })(_15.value0);
                      };
                      if (_15 instanceof FreeT) {
                          return new FreeT(function (_14) {
                              return Prelude["<$>"](__dict_Functor_17)(Prelude.map(Data_Either.functorEither)(function (_75) {
                                  return nf(Prelude.map(__dict_Functor_16)(bimapFreeT(__dict_Functor_16)(__dict_Functor_17)(nf)(nm))(_75));
                              }))(nm(_15.value0(Prelude.unit)));
                          });
                      };
                      throw new Error("Failed pattern match: " + [ nf.constructor.name, nm.constructor.name, _15.constructor.name ]);
                  };
              };
          };
      };
  };
  var hoistFreeT = function (__dict_Functor_18) {
      return function (__dict_Functor_19) {
          return bimapFreeT(__dict_Functor_18)(__dict_Functor_19)(Prelude.id(Prelude.categoryFn));
      };
  };
  var monadFreeT = function (__dict_Functor_8) {
      return function (__dict_Monad_9) {
          return new Prelude.Monad(function () {
              return applicativeFreeT(__dict_Functor_8)(__dict_Monad_9);
          }, function () {
              return bindFreeT(__dict_Functor_8)(__dict_Monad_9);
          });
      };
  };
  var bindFreeT = function (__dict_Functor_14) {
      return function (__dict_Monad_15) {
          return new Prelude.Bind(function () {
              return applyFreeT(__dict_Functor_14)(__dict_Monad_15);
          }, function (_18) {
              return function (f) {
                  if (_18 instanceof Bind) {
                      return Data_Exists.runExists(function (_9) {
                          return bound(_9.value0)(function (x) {
                              return bound(function (_8) {
                                  return _9.value1(x);
                              })(f);
                          });
                      })(_18.value0);
                  };
                  return bound(function (_10) {
                      return _18;
                  })(f);
              };
          });
      };
  };
  var applyFreeT = function (__dict_Functor_22) {
      return function (__dict_Monad_23) {
          return new Prelude.Apply(function () {
              return functorFreeT(__dict_Functor_22)(((__dict_Monad_23["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
          }, Prelude.ap(monadFreeT(__dict_Functor_22)(__dict_Monad_23)));
      };
  };
  var applicativeFreeT = function (__dict_Functor_24) {
      return function (__dict_Monad_25) {
          return new Prelude.Applicative(function () {
              return applyFreeT(__dict_Functor_24)(__dict_Monad_25);
          }, function (a) {
              return new FreeT(function (_7) {
                  return Prelude.pure(__dict_Monad_25["__superclass_Prelude.Applicative_0"]())(new Data_Either.Left(a));
              });
          });
      };
  };
  var liftFreeT = function (__dict_Functor_10) {
      return function (__dict_Monad_11) {
          return function (fa) {
              return new FreeT(function (_12) {
                  return Prelude["return"](__dict_Monad_11["__superclass_Prelude.Applicative_0"]())(new Data_Either.Right(Prelude.map(__dict_Functor_10)(Prelude.pure(applicativeFreeT(__dict_Functor_10)(__dict_Monad_11)))(fa)));
              });
          };
      };
  };
  var resume = function (__dict_Functor_0) {
      return function (__dict_MonadRec_1) {
          var go = function (_16) {
              if (_16 instanceof FreeT) {
                  return Prelude.map((((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Either.Right.create)(_16.value0(Prelude.unit));
              };
              if (_16 instanceof Bind) {
                  return Data_Exists.runExists(function (_4) {
                      var _51 = _4.value0(Prelude.unit);
                      if (_51 instanceof FreeT) {
                          return Prelude.bind((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())(_51.value0(Prelude.unit))(function (_0) {
                              if (_0 instanceof Data_Either.Left) {
                                  return Prelude["return"]((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Left(_4.value1(_0.value0)));
                              };
                              if (_0 instanceof Data_Either.Right) {
                                  return Prelude["return"]((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Right(new Data_Either.Right(Prelude.map(__dict_Functor_0)(function (h) {
                                      return Prelude[">>="](bindFreeT(__dict_Functor_0)(__dict_MonadRec_1["__superclass_Prelude.Monad_0"]()))(h)(_4.value1);
                                  })(_0.value0))));
                              };
                              throw new Error("Failed pattern match at Control.Monad.Free.Trans line 43, column 3 - line 44, column 3: " + [ _0.constructor.name ]);
                          });
                      };
                      if (_51 instanceof Bind) {
                          return Data_Exists.runExists(function (_3) {
                              return Prelude["return"]((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Left(Prelude.bind(bindFreeT(__dict_Functor_0)(__dict_MonadRec_1["__superclass_Prelude.Monad_0"]()))(_3.value0(Prelude.unit))(function (z) {
                                  return Prelude[">>="](bindFreeT(__dict_Functor_0)(__dict_MonadRec_1["__superclass_Prelude.Monad_0"]()))(_3.value1(z))(_4.value1);
                              })));
                          })(_51.value0);
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 43, column 3 - line 44, column 3: " + [ _51.constructor.name ]);
                  })(_16.value0);
              };
              throw new Error("Failed pattern match at Control.Monad.Free.Trans line 43, column 3 - line 44, column 3: " + [ _16.constructor.name ]);
          };
          return Control_Monad_Rec_Class.tailRecM(__dict_MonadRec_1)(go);
      };
  };
  var runFreeT = function (__dict_Functor_2) {
      return function (__dict_MonadRec_3) {
          return function (interp) {
              var go = function (_19) {
                  if (_19 instanceof Data_Either.Left) {
                      return Prelude["return"]((__dict_MonadRec_3["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Right(_19.value0));
                  };
                  if (_19 instanceof Data_Either.Right) {
                      return Prelude.bind((__dict_MonadRec_3["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())(interp(_19.value0))(function (_2) {
                          return Prelude["return"]((__dict_MonadRec_3["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Left(_2));
                      });
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free.Trans line 103, column 3 - line 104, column 3: " + [ _19.constructor.name ]);
              };
              return Control_Monad_Rec_Class.tailRecM(__dict_MonadRec_3)(Control_Bind["<=<"]((__dict_MonadRec_3["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())(go)(resume(__dict_Functor_2)(__dict_MonadRec_3)));
          };
      };
  };
  var monadRecFreeT = function (__dict_Functor_6) {
      return function (__dict_Monad_7) {
          return new Control_Monad_Rec_Class.MonadRec(function () {
              return monadFreeT(__dict_Functor_6)(__dict_Monad_7);
          }, function (f) {
              var go = function (s) {
                  return Prelude.bind(bindFreeT(__dict_Functor_6)(__dict_Monad_7))(f(s))(function (_1) {
                      if (_1 instanceof Data_Either.Left) {
                          return go(_1.value0);
                      };
                      if (_1 instanceof Data_Either.Right) {
                          return Prelude["return"](applicativeFreeT(__dict_Functor_6)(__dict_Monad_7))(_1.value0);
                      };
                      throw new Error("Failed pattern match at Control.Monad.Free.Trans line 73, column 1 - line 83, column 1: " + [ _1.constructor.name ]);
                  });
              };
              return go;
          });
      };
  };
  exports["runFreeT"] = runFreeT;
  exports["resume"] = resume;
  exports["bimapFreeT"] = bimapFreeT;
  exports["hoistFreeT"] = hoistFreeT;
  exports["liftFreeT"] = liftFreeT;
  exports["freeT"] = freeT;
  exports["functorFreeT"] = functorFreeT;
  exports["applyFreeT"] = applyFreeT;
  exports["applicativeFreeT"] = applicativeFreeT;
  exports["bindFreeT"] = bindFreeT;
  exports["monadFreeT"] = monadFreeT;
  exports["monadTransFreeT"] = monadTransFreeT;
  exports["monadRecFreeT"] = monadRecFreeT;;
 
})(PS["Control.Monad.Free.Trans"] = PS["Control.Monad.Free.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Profunctor = PS["Data.Profunctor"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var profunctorAwait = new Data_Profunctor.Profunctor(function (f) {
      return function (g) {
          return function (_22) {
              return Data_Profunctor.dimap(Data_Profunctor.profunctorFn)(f)(g)(_22);
          };
      };
  });
  var fuseWith = function (__dict_Functor_4) {
      return function (__dict_Functor_5) {
          return function (__dict_Functor_6) {
              return function (__dict_MonadRec_7) {
                  return function (zap) {
                      return function (fs) {
                          return function (gs) {
                              var go = function (_20) {
                                  return Prelude.bind((__dict_MonadRec_7["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())(Control_Monad_Free_Trans.resume(__dict_Functor_5)(__dict_MonadRec_7)(_20.value1))(function (_1) {
                                      return Prelude.bind((__dict_MonadRec_7["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())(Control_Monad_Free_Trans.resume(__dict_Functor_4)(__dict_MonadRec_7)(_20.value0))(function (_0) {
                                          var _31 = Prelude["<*>"](Data_Either.applyEither)(Prelude["<$>"](Data_Either.functorEither)(zap(Data_Tuple.Tuple.create))(_0))(_1);
                                          if (_31 instanceof Data_Either.Left) {
                                              return Prelude["return"]((__dict_MonadRec_7["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Left(_31.value0));
                                          };
                                          if (_31 instanceof Data_Either.Right) {
                                              return Prelude["return"]((__dict_MonadRec_7["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(new Data_Either.Right(Prelude.map(__dict_Functor_6)(function (t) {
                                                  return Control_Monad_Free_Trans.freeT(function (_5) {
                                                      return go(t);
                                                  });
                                              })(_31.value0)));
                                          };
                                          throw new Error("Failed pattern match at Control.Coroutine line 49, column 1 - line 54, column 1: " + [ _31.constructor.name ]);
                                      });
                                  });
                              };
                              return Control_Monad_Free_Trans.freeT(function (_6) {
                                  return go(new Data_Tuple.Tuple(fs, gs));
                              });
                          };
                      };
                  };
              };
          };
      };
  };
  var functorAwait = new Prelude.Functor(Data_Profunctor.rmap(profunctorAwait));
  var await = function (__dict_Monad_16) {
      return Control_Monad_Free_Trans.liftFreeT(functorAwait)(__dict_Monad_16)(Prelude.id(Prelude.categoryFn));
  };
  exports["await"] = await;
  exports["fuseWith"] = fuseWith;
  exports["profunctorAwait"] = profunctorAwait;
  exports["functorAwait"] = functorAwait;;
 
})(PS["Control.Coroutine"] = PS["Control.Coroutine"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];     
  var MonadEff = function (__superclass_Prelude$dotMonad_0, liftEff) {
      this["__superclass_Prelude.Monad_0"] = __superclass_Prelude$dotMonad_0;
      this.liftEff = liftEff;
  };
  var monadEffEff = new MonadEff(function () {
      return Control_Monad_Eff.monadEff;
  }, Prelude.id(Prelude.categoryFn));
  var liftEff = function (dict) {
      return dict.liftEff;
  };
  exports["MonadEff"] = MonadEff;
  exports["liftEff"] = liftEff;
  exports["monadEffEff"] = monadEffEff;;
 
})(PS["Control.Monad.Eff.Class"] = PS["Control.Monad.Eff.Class"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];     
  var MonadError = function (__superclass_Prelude$dotMonad_0, catchError, throwError) {
      this["__superclass_Prelude.Monad_0"] = __superclass_Prelude$dotMonad_0;
      this.catchError = catchError;
      this.throwError = throwError;
  };
  var throwError = function (dict) {
      return dict.throwError;
  };                          
  var catchError = function (dict) {
      return dict.catchError;
  };
  exports["MonadError"] = MonadError;
  exports["catchError"] = catchError;
  exports["throwError"] = throwError;;
 
})(PS["Control.Monad.Error.Class"] = PS["Control.Monad.Error.Class"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Tuple = PS["Data.Tuple"];     
  var MonadState = function (__superclass_Prelude$dotMonad_0, state) {
      this["__superclass_Prelude.Monad_0"] = __superclass_Prelude$dotMonad_0;
      this.state = state;
  };
  var state = function (dict) {
      return dict.state;
  };
  var modify = function (__dict_MonadState_1) {
      return function (f) {
          return state(__dict_MonadState_1)(function (s) {
              return new Data_Tuple.Tuple(Prelude.unit, f(s));
          });
      };
  };
  var gets = function (__dict_MonadState_2) {
      return function (f) {
          return state(__dict_MonadState_2)(function (s) {
              return new Data_Tuple.Tuple(f(s), s);
          });
      };
  };
  var get = function (__dict_MonadState_3) {
      return state(__dict_MonadState_3)(function (s) {
          return new Data_Tuple.Tuple(s, s);
      });
  };
  exports["MonadState"] = MonadState;
  exports["modify"] = modify;
  exports["gets"] = gets;
  exports["get"] = get;
  exports["state"] = state;;
 
})(PS["Control.Monad.State.Class"] = PS["Control.Monad.State.Class"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_RWS_Class = PS["Control.Monad.RWS.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];     
  var MaybeT = function (x) {
      return x;
  };
  var runMaybeT = function (_5) {
      return _5;
  };
  var monadMaybeT = function (__dict_Monad_7) {
      return new Prelude.Monad(function () {
          return applicativeMaybeT(__dict_Monad_7);
      }, function () {
          return bindMaybeT(__dict_Monad_7);
      });
  };
  var functorMaybeT = function (__dict_Monad_14) {
      return new Prelude.Functor(Prelude.liftA1(applicativeMaybeT(__dict_Monad_14)));
  };
  var bindMaybeT = function (__dict_Monad_15) {
      return new Prelude.Bind(function () {
          return applyMaybeT(__dict_Monad_15);
      }, function (x) {
          return function (f) {
              return MaybeT(Prelude.bind(__dict_Monad_15["__superclass_Prelude.Bind_1"]())(runMaybeT(x))(function (_0) {
                  if (_0 instanceof Data_Maybe.Nothing) {
                      return Prelude["return"](__dict_Monad_15["__superclass_Prelude.Applicative_0"]())(Data_Maybe.Nothing.value);
                  };
                  if (_0 instanceof Data_Maybe.Just) {
                      return runMaybeT(f(_0.value0));
                  };
                  throw new Error("Failed pattern match: " + [ _0.constructor.name ]);
              }));
          };
      });
  };
  var applyMaybeT = function (__dict_Monad_16) {
      return new Prelude.Apply(function () {
          return functorMaybeT(__dict_Monad_16);
      }, Prelude.ap(monadMaybeT(__dict_Monad_16)));
  };
  var applicativeMaybeT = function (__dict_Monad_17) {
      return new Prelude.Applicative(function () {
          return applyMaybeT(__dict_Monad_17);
      }, function (_28) {
          return MaybeT(Prelude.pure(__dict_Monad_17["__superclass_Prelude.Applicative_0"]())(Data_Maybe.Just.create(_28)));
      });
  };
  var monadRecMaybeT = function (__dict_MonadRec_3) {
      return new Control_Monad_Rec_Class.MonadRec(function () {
          return monadMaybeT(__dict_MonadRec_3["__superclass_Prelude.Monad_0"]());
      }, function (f) {
          return function (_31) {
              return MaybeT(Control_Monad_Rec_Class.tailRecM(__dict_MonadRec_3)(function (a) {
                  return Prelude.bind((__dict_MonadRec_3["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())(runMaybeT(f(a)))(function (_2) {
                      return Prelude["return"]((__dict_MonadRec_3["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())((function () {
                          if (_2 instanceof Data_Maybe.Nothing) {
                              return new Data_Either.Right(Data_Maybe.Nothing.value);
                          };
                          if (_2 instanceof Data_Maybe.Just && _2.value0 instanceof Data_Either.Left) {
                              return new Data_Either.Left(_2.value0.value0);
                          };
                          if (_2 instanceof Data_Maybe.Just && _2.value0 instanceof Data_Either.Right) {
                              return new Data_Either.Right(new Data_Maybe.Just(_2.value0.value0));
                          };
                          throw new Error("Failed pattern match at Control.Monad.Maybe.Trans line 78, column 1 - line 86, column 1: " + [ _2.constructor.name ]);
                      })());
                  });
              })(_31));
          };
      });
  };
  var altMaybeT = function (__dict_Monad_19) {
      return new Control_Alt.Alt(function () {
          return functorMaybeT(__dict_Monad_19);
      }, function (m1) {
          return function (m2) {
              return Prelude.bind(__dict_Monad_19["__superclass_Prelude.Bind_1"]())(runMaybeT(m1))(function (_1) {
                  if (_1 instanceof Data_Maybe.Nothing) {
                      return runMaybeT(m2);
                  };
                  return Prelude["return"](__dict_Monad_19["__superclass_Prelude.Applicative_0"]())(_1);
              });
          };
      });
  };
  var plusMaybeT = function (__dict_Monad_0) {
      return new Control_Plus.Plus(function () {
          return altMaybeT(__dict_Monad_0);
      }, Prelude.pure(__dict_Monad_0["__superclass_Prelude.Applicative_0"]())(Data_Maybe.Nothing.value));
  };
  exports["MaybeT"] = MaybeT;
  exports["runMaybeT"] = runMaybeT;
  exports["functorMaybeT"] = functorMaybeT;
  exports["applyMaybeT"] = applyMaybeT;
  exports["applicativeMaybeT"] = applicativeMaybeT;
  exports["bindMaybeT"] = bindMaybeT;
  exports["monadMaybeT"] = monadMaybeT;
  exports["altMaybeT"] = altMaybeT;
  exports["plusMaybeT"] = plusMaybeT;
  exports["monadRecMaybeT"] = monadRecMaybeT;;
 
})(PS["Control.Monad.Maybe.Trans"] = PS["Control.Monad.Maybe.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Functor = PS["Data.Functor"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Maybe = PS["Data.Maybe"];     
  var Emit = (function () {
      function Emit(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Emit.create = function (value0) {
          return function (value1) {
              return new Emit(value0, value1);
          };
      };
      return Emit;
  })();
  var Stall = (function () {
      function Stall(value0) {
          this.value0 = value0;
      };
      Stall.create = function (value0) {
          return new Stall(value0);
      };
      return Stall;
  })();
  var runStallingProcess = function (__dict_MonadRec_2) {
      return function (_19) {
          return Control_Monad_Maybe_Trans.runMaybeT(Control_Monad_Free_Trans.runFreeT(Data_Maybe.functorMaybe)(Control_Monad_Maybe_Trans.monadRecMaybeT(__dict_MonadRec_2))(Data_Maybe.maybe(Control_Plus.empty(Control_Monad_Maybe_Trans.plusMaybeT(__dict_MonadRec_2["__superclass_Prelude.Monad_0"]())))(Prelude.pure(Control_Monad_Maybe_Trans.applicativeMaybeT(__dict_MonadRec_2["__superclass_Prelude.Monad_0"]()))))(Control_Monad_Free_Trans.hoistFreeT(Data_Maybe.functorMaybe)(Control_Monad_Maybe_Trans.functorMaybeT(__dict_MonadRec_2["__superclass_Prelude.Monad_0"]()))(function (_20) {
              return Control_Monad_Maybe_Trans.MaybeT(Prelude.map((((__dict_MonadRec_2["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Maybe.Just.create)(_20));
          })(_19)));
      };
  };
  var bifunctorStallF = new Data_Bifunctor.Bifunctor(function (f) {
      return function (g) {
          return function (q) {
              if (q instanceof Emit) {
                  return new Emit(f(q.value0), g(q.value1));
              };
              if (q instanceof Stall) {
                  return new Stall(g(q.value0));
              };
              throw new Error("Failed pattern match at Control.Coroutine.Stalling line 50, column 1 - line 56, column 1: " + [ q.constructor.name ]);
          };
      };
  });
  var functorStallF = new Prelude.Functor(function (f) {
      return Data_Bifunctor.rmap(bifunctorStallF)(f);
  });
  var $dollar$dollar$qmark = function (__dict_MonadRec_0) {
      return Control_Coroutine.fuseWith(functorStallF)(Control_Coroutine.functorAwait)(Data_Maybe.functorMaybe)(__dict_MonadRec_0)(function (f) {
          return function (q) {
              return function (_0) {
                  if (q instanceof Emit) {
                      return new Data_Maybe.Just(f(q.value1)(_0(q.value0)));
                  };
                  if (q instanceof Stall) {
                      return Data_Maybe.Nothing.value;
                  };
                  throw new Error("Failed pattern match at Control.Coroutine.Stalling line 79, column 1 - line 85, column 1: " + [ q.constructor.name ]);
              };
          };
      });
  };
  exports["Emit"] = Emit;
  exports["Stall"] = Stall;
  exports["$$?"] = $dollar$dollar$qmark;
  exports["runStallingProcess"] = runStallingProcess;
  exports["bifunctorStallF"] = bifunctorStallF;
  exports["functorStallF"] = functorStallF;;
 
})(PS["Control.Coroutine.Stalling"] = PS["Control.Coroutine.Stalling"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports._setTimeout = function (nonCanceler, millis, aff) {
    var set = setTimeout, clear = clearTimeout;
    if (millis <= 0 && typeof setImmediate === "function") {
      set = setImmediate;
      clear = clearImmediate;
    }
    return function(success, error) {
      var canceler;

      var timeout = set(function() {
        canceler = aff(success, error);
      }, millis);

      return function(e) {
        return function(s, f) {
          if (canceler !== undefined) {
            return canceler(e)(s, f);
          } else {
            clear(timeout);

            try {
              s(true);
            } catch (err) {
              f(err);
            }

            return nonCanceler;
          }
        };
      };
    };
  }

  exports._forkAff = function (nonCanceler, aff) {
    var voidF = function(){};

    return function(success, error) {
      var canceler = aff(voidF, voidF);

      try {
        success(canceler);
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    };
  }

  exports._forkAll = function (nonCanceler, foldl, affs) {
    var voidF = function(){};

    return function(success, error) {
      var cancelers = foldl(function(acc) {
        return function(aff) {
          acc.push(aff(voidF, voidF));
          return acc;
        }
      })([])(affs);

      var canceler = function(e) {
        return function(success, error) {
          var cancellations = 0;
          var result        = false;
          var errored       = false;

          var s = function(bool) {
            cancellations = cancellations + 1;
            result        = result || bool;

            if (cancellations === cancelers.length && !errored) {
              try {
                success(result);
              } catch (err) {
                error(err);
              }
            }
          };

          var f = function(err) {
            if (!errored) {
              errored = true;
              error(err);
            }
          };

          for (var i = 0; i < cancelers.length; i++) {
            cancelers[i](e)(s, f);
          }

          return nonCanceler;
        };
      };

      try {
        success(canceler);
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    };
  }

  exports._makeAff = function (cb) {
    return function(success, error) {
      return cb(function(e) {
        return function() {
          error(e);
        };
      })(function(v) {
        return function() {
          try {
            success(v);
          } catch (err) {
            error(err);
          }
        };
      })();
    }
  }

  exports._pure = function (nonCanceler, v) {
    return function(success, error) {
      try {
        success(v);
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    };
  }

  exports._throwError = function (nonCanceler, e) {
    return function(success, error) {
      error(e);

      return nonCanceler;
    };
  }

  exports._fmap = function (f, aff) {
    return function(success, error) {
      return aff(function(v) {
        try {
          success(f(v));
        } catch (err) {
          error(err);
        }
      }, error);
    };
  }

  exports._bind = function (alwaysCanceler, aff, f) {
    return function(success, error) {
      var canceler1, canceler2;

      var isCanceled    = false;
      var requestCancel = false;

      var onCanceler = function(){};

      canceler1 = aff(function(v) {
        if (requestCancel) {
          isCanceled = true;

          return alwaysCanceler;
        } else {
          canceler2 = f(v)(success, error);

          onCanceler(canceler2);

          return canceler2;
        }
      }, error);

      return function(e) {
        return function(s, f) {
          requestCancel = true;

          if (canceler2 !== undefined) {
            return canceler2(e)(s, f);
          } else {
            return canceler1(e)(function(bool) {
              if (bool || isCanceled) {
                try {
                  s(true);
                } catch (err) {
                  f(err);
                }
              } else {
                onCanceler = function(canceler) {
                  canceler(e)(s, f);
                };
              }
            }, f);
          }
        };
      };
    };
  }

  exports._attempt = function (Left, Right, aff) {
    return function(success, error) {
      return aff(function(v) {
        try {
          success(Right(v));
        } catch (err) {
          error(err);
        }
      }, function(e) {
        try {
          success(Left(e));
        } catch (err) {
          error(err);
        }
      });
    };
  }

  exports._runAff = function (errorT, successT, aff) {
    return function() {
      return aff(function(v) {
        try {
          successT(v)();
        } catch (err) {
          errorT(err)();
        }
      }, function(e) {
        errorT(e)();
      });
    };
  }

  exports._liftEff = function (nonCanceler, e) {
    return function(success, error) {
      try {
        success(e());
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    };
  }
 
})(PS["Control.Monad.Aff"] = PS["Control.Monad.Aff"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.error = function (msg) {
    return new Error(msg);
  };

  exports.throwException = function (e) {
    return function () {
      throw e;
    };
  };
 
})(PS["Control.Monad.Eff.Exception"] = PS["Control.Monad.Eff.Exception"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Control.Monad.Eff.Exception"];
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  exports["throwException"] = $foreign.throwException;
  exports["error"] = $foreign.error;;
 
})(PS["Control.Monad.Eff.Exception"] = PS["Control.Monad.Eff.Exception"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.runFn2 = function (fn) {
    return function (a) {
      return function (b) {
        return fn(a, b);
      };
    };
  };
 
})(PS["Data.Function"] = PS["Data.Function"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Function"];
  var Prelude = PS["Prelude"];
  exports["runFn2"] = $foreign.runFn2;;
 
})(PS["Data.Function"] = PS["Data.Function"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Control.Monad.Aff"];
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Monoid = PS["Data.Monoid"];
  var runAff = function (ex) {
      return function (f) {
          return function (aff) {
              return $foreign._runAff(ex, f, aff);
          };
      };
  };
  var makeAff$prime = function (h) {
      return $foreign._makeAff(h);
  };
  var functorAff = new Prelude.Functor(function (f) {
      return function (fa) {
          return $foreign._fmap(f, fa);
      };
  });
  var attempt = function (aff) {
      return $foreign._attempt(Data_Either.Left.create, Data_Either.Right.create, aff);
  };
  var applyAff = new Prelude.Apply(function () {
      return functorAff;
  }, function (ff) {
      return function (fa) {
          return $foreign._bind(alwaysCanceler, ff, function (f) {
              return Prelude["<$>"](functorAff)(f)(fa);
          });
      };
  });
  var applicativeAff = new Prelude.Applicative(function () {
      return applyAff;
  }, function (v) {
      return $foreign._pure(nonCanceler, v);
  });
  var nonCanceler = Prelude["const"](Prelude.pure(applicativeAff)(false));
  var alwaysCanceler = Prelude["const"](Prelude.pure(applicativeAff)(true));
  var forkAff = function (aff) {
      return $foreign._forkAff(nonCanceler, aff);
  };
  var forkAll = function (__dict_Foldable_2) {
      return function (affs) {
          return $foreign._forkAll(nonCanceler, Data_Foldable.foldl(__dict_Foldable_2), affs);
      };
  };
  var later$prime = function (n) {
      return function (aff) {
          return $foreign._setTimeout(nonCanceler, n, aff);
      };
  };
  var later = later$prime(0);
  var makeAff = function (h) {
      return makeAff$prime(function (e) {
          return function (a) {
              return Prelude["<$>"](Control_Monad_Eff.functorEff)(Prelude["const"](nonCanceler))(h(e)(a));
          };
      });
  };                                                       
  var bindAff = new Prelude.Bind(function () {
      return applyAff;
  }, function (fa) {
      return function (f) {
          return $foreign._bind(alwaysCanceler, fa, f);
      };
  });
  var monadAff = new Prelude.Monad(function () {
      return applicativeAff;
  }, function () {
      return bindAff;
  });
  var monadEffAff = new Control_Monad_Eff_Class.MonadEff(function () {
      return monadAff;
  }, function (eff) {
      return $foreign._liftEff(nonCanceler, eff);
  });
  var monadErrorAff = new Control_Monad_Error_Class.MonadError(function () {
      return monadAff;
  }, function (aff) {
      return function (ex) {
          return Prelude[">>="](bindAff)(attempt(aff))(Data_Either.either(ex)(Prelude.pure(applicativeAff)));
      };
  }, function (e) {
      return $foreign._throwError(nonCanceler, e);
  });
  var monadRecAff = new Control_Monad_Rec_Class.MonadRec(function () {
      return monadAff;
  }, function (f) {
      return function (a) {
          var go = function (size) {
              return function (f_1) {
                  return function (a_1) {
                      return Prelude.bind(bindAff)(f_1(a_1))(function (_1) {
                          if (_1 instanceof Data_Either.Left) {
                              if (size < 100) {
                                  return go(size + 1 | 0)(f_1)(_1.value0);
                              };
                              if (Prelude.otherwise) {
                                  return later(Control_Monad_Rec_Class.tailRecM(monadRecAff)(f_1)(_1.value0));
                              };
                          };
                          if (_1 instanceof Data_Either.Right) {
                              return Prelude.pure(applicativeAff)(_1.value0);
                          };
                          throw new Error("Failed pattern match: " + [ _1.constructor.name ]);
                      });
                  };
              };
          };
          return go(0)(f)(a);
      };
  });
  var altAff = new Control_Alt.Alt(function () {
      return functorAff;
  }, function (a1) {
      return function (a2) {
          return Prelude[">>="](bindAff)(attempt(a1))(Data_Either.either(Prelude["const"](a2))(Prelude.pure(applicativeAff)));
      };
  });
  var plusAff = new Control_Plus.Plus(function () {
      return altAff;
  }, Control_Monad_Error_Class.throwError(monadErrorAff)(Control_Monad_Eff_Exception.error("Always fails")));
  exports["runAff"] = runAff;
  exports["nonCanceler"] = nonCanceler;
  exports["makeAff"] = makeAff;
  exports["later"] = later;
  exports["forkAll"] = forkAll;
  exports["forkAff"] = forkAff;
  exports["attempt"] = attempt;
  exports["functorAff"] = functorAff;
  exports["applyAff"] = applyAff;
  exports["applicativeAff"] = applicativeAff;
  exports["bindAff"] = bindAff;
  exports["monadAff"] = monadAff;
  exports["monadEffAff"] = monadEffAff;
  exports["monadErrorAff"] = monadErrorAff;
  exports["altAff"] = altAff;
  exports["plusAff"] = plusAff;
  exports["monadRecAff"] = monadRecAff;;
 
})(PS["Control.Monad.Aff"] = PS["Control.Monad.Aff"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Control.Monad.Aff.AVar

  exports._makeVar = function (nonCanceler) {
    return function(success, error) {
      try {
        success({
          consumers: [],
          producers: [],
          error: undefined
        });
      } catch (err) {
        error(err);
      }

      return nonCanceler;
    }
  }

  exports._takeVar = function (nonCanceler, avar) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else if (avar.producers.length > 0) {
        var producer = avar.producers.shift();

        producer(success, error);
      } else {
        avar.consumers.push({success: success, error: error});
      }

      return nonCanceler;
    }
  }

  exports._putVar = function (nonCanceler, avar, a) {
    return function(success, error) {
      if (avar.error !== undefined) {
        error(avar.error);
      } else if (avar.consumers.length === 0) {
        avar.producers.push(function(success, error) {
          try {
            success(a);
          } catch (err) {
            error(err);
          }
        });

        success({});
      } else {
        var consumer = avar.consumers.shift();

        try {
          consumer.success(a);
        } catch (err) {
          error(err);

          return;
        }

        success({});
      }

      return nonCanceler;
    }
  }
 
})(PS["Control.Monad.Aff.AVar"] = PS["Control.Monad.Aff.AVar"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Control.Monad.Aff.AVar"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Function = PS["Data.Function"];     
  var takeVar = function (q) {
      return $foreign._takeVar(Control_Monad_Aff.nonCanceler, q);
  };
  var putVar = function (q) {
      return function (a) {
          return $foreign._putVar(Control_Monad_Aff.nonCanceler, q, a);
      };
  };
  var modifyVar = function (f) {
      return function (v) {
          return Prelude[">>="](Control_Monad_Aff.bindAff)(takeVar(v))(Prelude[">>>"](Prelude.semigroupoidFn)(f)(putVar(v)));
      };
  };
  var makeVar = $foreign._makeVar(Control_Monad_Aff.nonCanceler);
  var makeVar$prime = function (a) {
      return Prelude.bind(Control_Monad_Aff.bindAff)(makeVar)(function (_0) {
          return Prelude.bind(Control_Monad_Aff.bindAff)(putVar(_0)(a))(function () {
              return Prelude["return"](Control_Monad_Aff.applicativeAff)(_0);
          });
      });
  };
  exports["takeVar"] = takeVar;
  exports["putVar"] = putVar;
  exports["modifyVar"] = modifyVar;
  exports["makeVar'"] = makeVar$prime;
  exports["makeVar"] = makeVar;;
 
})(PS["Control.Monad.Aff.AVar"] = PS["Control.Monad.Aff.AVar"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Unfoldable = PS["Data.Unfoldable"];     
  var Nil = (function () {
      function Nil() {

      };
      Nil.value = new Nil();
      return Nil;
  })();
  var Cons = (function () {
      function Cons(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Cons.create = function (value0) {
          return function (value1) {
              return new Cons(value0, value1);
          };
      };
      return Cons;
  })();
  var $colon = Cons.create;
  var reverse = (function () {
      var go = function (__copy_acc) {
          return function (__copy__42) {
              var acc = __copy_acc;
              var _42 = __copy__42;
              tco: while (true) {
                  var acc_1 = acc;
                  if (_42 instanceof Nil) {
                      return acc_1;
                  };
                  if (_42 instanceof Cons) {
                      var __tco_acc = new Cons(_42.value0, acc);
                      var __tco__42 = _42.value1;
                      acc = __tco_acc;
                      _42 = __tco__42;
                      continue tco;
                  };
                  throw new Error("Failed pattern match at Data.List line 370, column 1 - line 371, column 1: " + [ acc.constructor.name, _42.constructor.name ]);
              };
          };
      };
      return go(Nil.value);
  })();
  var foldableList = new Data_Foldable.Foldable(function (__dict_Monoid_18) {
      return function (f) {
          return Data_Foldable.foldl(foldableList)(function (acc) {
              return function (_326) {
                  return Prelude.append(__dict_Monoid_18["__superclass_Prelude.Semigroup_0"]())(acc)(f(_326));
              };
          })(Data_Monoid.mempty(__dict_Monoid_18));
      };
  }, (function () {
      var go = function (__copy_o) {
          return function (__copy_b) {
              return function (__copy__67) {
                  var o = __copy_o;
                  var b = __copy_b;
                  var _67 = __copy__67;
                  tco: while (true) {
                      var b_1 = b;
                      if (_67 instanceof Nil) {
                          return b_1;
                      };
                      if (_67 instanceof Cons) {
                          var __tco_o = o;
                          var __tco_b = o(b)(_67.value0);
                          var __tco__67 = _67.value1;
                          o = __tco_o;
                          b = __tco_b;
                          _67 = __tco__67;
                          continue tco;
                      };
                      throw new Error("Failed pattern match: " + [ o.constructor.name, b.constructor.name, _67.constructor.name ]);
                  };
              };
          };
      };
      return go;
  })(), function (o) {
      return function (b) {
          return function (_66) {
              if (_66 instanceof Nil) {
                  return b;
              };
              if (_66 instanceof Cons) {
                  return o(_66.value0)(Data_Foldable.foldr(foldableList)(o)(b)(_66.value1));
              };
              throw new Error("Failed pattern match: " + [ o.constructor.name, b.constructor.name, _66.constructor.name ]);
          };
      };
  });
  exports["Nil"] = Nil;
  exports["Cons"] = Cons;
  exports["reverse"] = reverse;
  exports[":"] = $colon;
  exports["foldableList"] = foldableList;;
 
})(PS["Data.List"] = PS["Data.List"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];     
  var CatQueue = (function () {
      function CatQueue(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      CatQueue.create = function (value0) {
          return function (value1) {
              return new CatQueue(value0, value1);
          };
      };
      return CatQueue;
  })();
  var uncons = function (__copy__2) {
      var _2 = __copy__2;
      tco: while (true) {
          if (_2.value0 instanceof Data_List.Nil && _2.value1 instanceof Data_List.Nil) {
              return Data_Maybe.Nothing.value;
          };
          if (_2.value0 instanceof Data_List.Nil) {
              var __tco__2 = new CatQueue(Data_List.reverse(_2.value1), Data_List.Nil.value);
              _2 = __tco__2;
              continue tco;
          };
          if (_2.value0 instanceof Data_List.Cons) {
              return new Data_Maybe.Just(new Data_Tuple.Tuple(_2.value0.value0, new CatQueue(_2.value0.value1, _2.value1)));
          };
          throw new Error("Failed pattern match: " + [ _2.constructor.name ]);
      };
  };
  var snoc = function (_1) {
      return function (a) {
          return new CatQueue(_1.value0, new Data_List.Cons(a, _1.value1));
      };
  };
  var $$null = function (_0) {
      if (_0.value0 instanceof Data_List.Nil && _0.value1 instanceof Data_List.Nil) {
          return true;
      };
      return false;
  };
  var empty = new CatQueue(Data_List.Nil.value, Data_List.Nil.value);
  exports["CatQueue"] = CatQueue;
  exports["uncons"] = uncons;
  exports["snoc"] = snoc;
  exports["null"] = $$null;
  exports["empty"] = empty;;
 
})(PS["Data.CatQueue"] = PS["Data.CatQueue"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_CatQueue = PS["Data.CatQueue"];
  var Data_List = PS["Data.List"];     
  var CatNil = (function () {
      function CatNil() {

      };
      CatNil.value = new CatNil();
      return CatNil;
  })();
  var CatCons = (function () {
      function CatCons(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      CatCons.create = function (value0) {
          return function (value1) {
              return new CatCons(value0, value1);
          };
      };
      return CatCons;
  })();
  var link = function (_4) {
      return function (cat) {
          if (_4 instanceof CatNil) {
              return cat;
          };
          if (_4 instanceof CatCons) {
              return new CatCons(_4.value0, Data_CatQueue.snoc(_4.value1)(cat));
          };
          throw new Error("Failed pattern match at Data.CatList line 88, column 1 - line 89, column 1: " + [ _4.constructor.name, cat.constructor.name ]);
      };
  };
  var foldr = function (k) {
      return function (b) {
          return function (q) {
              var foldl = function (__copy_k_1) {
                  return function (__copy_c) {
                      return function (__copy__5) {
                          var k_1 = __copy_k_1;
                          var c = __copy_c;
                          var _5 = __copy__5;
                          tco: while (true) {
                              var c_1 = c;
                              if (_5 instanceof Data_List.Nil) {
                                  return c_1;
                              };
                              if (_5 instanceof Data_List.Cons) {
                                  var __tco_k_1 = k_1;
                                  var __tco_c = k_1(c)(_5.value0);
                                  var __tco__5 = _5.value1;
                                  k_1 = __tco_k_1;
                                  c = __tco_c;
                                  _5 = __tco__5;
                                  continue tco;
                              };
                              throw new Error("Failed pattern match at Data.CatList line 95, column 1 - line 96, column 1: " + [ k_1.constructor.name, c.constructor.name, _5.constructor.name ]);
                          };
                      };
                  };
              };
              var go = function (__copy_xs) {
                  return function (__copy_ys) {
                      var xs = __copy_xs;
                      var ys = __copy_ys;
                      tco: while (true) {
                          var _20 = Data_CatQueue.uncons(xs);
                          if (_20 instanceof Data_Maybe.Nothing) {
                              return foldl(function (x) {
                                  return function (i) {
                                      return i(x);
                                  };
                              })(b)(ys);
                          };
                          if (_20 instanceof Data_Maybe.Just) {
                              var __tco_ys = new Data_List.Cons(k(_20.value0.value0), ys);
                              xs = _20.value0.value1;
                              ys = __tco_ys;
                              continue tco;
                          };
                          throw new Error("Failed pattern match at Data.CatList line 95, column 1 - line 96, column 1: " + [ _20.constructor.name ]);
                      };
                  };
              };
              return go(q)(Data_List.Nil.value);
          };
      };
  };
  var uncons = function (_3) {
      if (_3 instanceof CatNil) {
          return Data_Maybe.Nothing.value;
      };
      if (_3 instanceof CatCons) {
          return new Data_Maybe.Just(new Data_Tuple.Tuple(_3.value0, (function () {
              var _25 = Data_CatQueue["null"](_3.value1);
              if (_25) {
                  return CatNil.value;
              };
              if (!_25) {
                  return foldr(link)(CatNil.value)(_3.value1);
              };
              throw new Error("Failed pattern match at Data.CatList line 79, column 1 - line 80, column 1: " + [ _25.constructor.name ]);
          })()));
      };
      throw new Error("Failed pattern match at Data.CatList line 79, column 1 - line 80, column 1: " + [ _3.constructor.name ]);
  };
  var empty = CatNil.value;
  var append = function (_1) {
      return function (_2) {
          if (_2 instanceof CatNil) {
              return _1;
          };
          if (_1 instanceof CatNil) {
              return _2;
          };
          return link(_1)(_2);
      };
  };
  var semigroupCatList = new Prelude.Semigroup(append);
  var snoc = function (cat) {
      return function (a) {
          return append(cat)(new CatCons(a, Data_CatQueue.empty));
      };
  };
  exports["CatNil"] = CatNil;
  exports["CatCons"] = CatCons;
  exports["uncons"] = uncons;
  exports["snoc"] = snoc;
  exports["append"] = append;
  exports["empty"] = empty;
  exports["semigroupCatList"] = semigroupCatList;;
 
})(PS["Data.CatList"] = PS["Data.CatList"] || {});
(function(exports) {
  "use strict";

  // module Unsafe.Coerce

  exports.unsafeCoerce = function(x) { return x; }
 
})(PS["Unsafe.Coerce"] = PS["Unsafe.Coerce"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Unsafe.Coerce"];
  exports["unsafeCoerce"] = $foreign.unsafeCoerce;;
 
})(PS["Unsafe.Coerce"] = PS["Unsafe.Coerce"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Data_CatList = PS["Data.CatList"];
  var Data_Either = PS["Data.Either"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Inject = PS["Data.Inject"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Data_Tuple = PS["Data.Tuple"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Free = (function () {
      function Free(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Free.create = function (value0) {
          return function (value1) {
              return new Free(value0, value1);
          };
      };
      return Free;
  })();
  var Return = (function () {
      function Return(value0) {
          this.value0 = value0;
      };
      Return.create = function (value0) {
          return new Return(value0);
      };
      return Return;
  })();
  var Bind = (function () {
      function Bind(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Bind.create = function (value0) {
          return function (value1) {
              return new Bind(value0, value1);
          };
      };
      return Bind;
  })();
  var toView = function (__copy__0) {
      var _0 = __copy__0;
      tco: while (true) {
          var runExpF = function (_3) {
              return _3;
          };
          var concatF = function (_2) {
              return function (r) {
                  return new Free(_2.value0, Prelude["<>"](Data_CatList.semigroupCatList)(_2.value1)(r));
              };
          };
          if (_0.value0 instanceof Return) {
              var _11 = Data_CatList.uncons(_0.value1);
              if (_11 instanceof Data_Maybe.Nothing) {
                  return new Return(Unsafe_Coerce.unsafeCoerce(_0.value0.value0));
              };
              if (_11 instanceof Data_Maybe.Just) {
                  var __tco__0 = Unsafe_Coerce.unsafeCoerce(concatF(runExpF(_11.value0.value0)(_0.value0.value0))(_11.value0.value1));
                  _0 = __tco__0;
                  continue tco;
              };
              throw new Error("Failed pattern match: " + [ _11.constructor.name ]);
          };
          if (_0.value0 instanceof Bind) {
              return new Bind(_0.value0.value0, function (a) {
                  return Unsafe_Coerce.unsafeCoerce(concatF(_0.value0.value1(a))(_0.value1));
              });
          };
          throw new Error("Failed pattern match: " + [ _0.value0.constructor.name ]);
      };
  };
  var runFreeM = function (__dict_Functor_0) {
      return function (__dict_MonadRec_1) {
          return function (k) {
              var go = function (f) {
                  var _20 = toView(f);
                  if (_20 instanceof Return) {
                      return Prelude["<$>"]((((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Either.Right.create)(Prelude.pure((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Applicative_0"]())(_20.value0));
                  };
                  if (_20 instanceof Bind) {
                      return Prelude["<$>"]((((__dict_MonadRec_1["__superclass_Prelude.Monad_0"]())["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Either.Left.create)(k(Prelude["<$>"](__dict_Functor_0)(_20.value1)(_20.value0)));
                  };
                  throw new Error("Failed pattern match at Control.Monad.Free line 123, column 3 - line 124, column 3: " + [ _20.constructor.name ]);
              };
              return Control_Monad_Rec_Class.tailRecM(__dict_MonadRec_1)(go);
          };
      };
  };
  var fromView = function (f) {
      return new Free(Unsafe_Coerce.unsafeCoerce(f), Data_CatList.empty);
  };
  var freeMonad = new Prelude.Monad(function () {
      return freeApplicative;
  }, function () {
      return freeBind;
  });
  var freeFunctor = new Prelude.Functor(function (k) {
      return function (f) {
          return Prelude[">>="](freeBind)(f)(function (_35) {
              return Prelude["return"](freeApplicative)(k(_35));
          });
      };
  });
  var freeBind = new Prelude.Bind(function () {
      return freeApply;
  }, function (_1) {
      return function (k) {
          return new Free(_1.value0, Data_CatList.snoc(_1.value1)(Unsafe_Coerce.unsafeCoerce(k)));
      };
  });
  var freeApply = new Prelude.Apply(function () {
      return freeFunctor;
  }, Prelude.ap(freeMonad));
  var freeApplicative = new Prelude.Applicative(function () {
      return freeApply;
  }, function (_36) {
      return fromView(Return.create(_36));
  });
  var liftF = function (f) {
      return fromView(new Bind(Unsafe_Coerce.unsafeCoerce(f), function (_37) {
          return Prelude.pure(freeApplicative)(Unsafe_Coerce.unsafeCoerce(_37));
      }));
  };
  exports["runFreeM"] = runFreeM;
  exports["liftF"] = liftF;
  exports["freeFunctor"] = freeFunctor;
  exports["freeBind"] = freeBind;
  exports["freeApplicative"] = freeApplicative;
  exports["freeApply"] = freeApply;
  exports["freeMonad"] = freeMonad;;
 
})(PS["Control.Monad.Free"] = PS["Control.Monad.Free"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Either = PS["Data.Either"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];     
  var StateT = function (x) {
      return x;
  };
  var runStateT = function (_6) {
      return _6;
  };
  var monadStateT = function (__dict_Monad_5) {
      return new Prelude.Monad(function () {
          return applicativeStateT(__dict_Monad_5);
      }, function () {
          return bindStateT(__dict_Monad_5);
      });
  };
  var functorStateT = function (__dict_Monad_14) {
      return new Prelude.Functor(Prelude.liftM1(monadStateT(__dict_Monad_14)));
  };
  var bindStateT = function (__dict_Monad_17) {
      return new Prelude.Bind(function () {
          return applyStateT(__dict_Monad_17);
      }, function (_7) {
          return function (f) {
              return function (s) {
                  return Prelude.bind(__dict_Monad_17["__superclass_Prelude.Bind_1"]())(_7(s))(function (_0) {
                      return runStateT(f(_0.value0))(_0.value1);
                  });
              };
          };
      });
  };
  var applyStateT = function (__dict_Monad_18) {
      return new Prelude.Apply(function () {
          return functorStateT(__dict_Monad_18);
      }, Prelude.ap(monadStateT(__dict_Monad_18)));
  };
  var applicativeStateT = function (__dict_Monad_19) {
      return new Prelude.Applicative(function () {
          return applyStateT(__dict_Monad_19);
      }, function (a) {
          return StateT(function (s) {
              return Prelude["return"](__dict_Monad_19["__superclass_Prelude.Applicative_0"]())(new Data_Tuple.Tuple(a, s));
          });
      });
  };
  var monadStateStateT = function (__dict_Monad_6) {
      return new Control_Monad_State_Class.MonadState(function () {
          return monadStateT(__dict_Monad_6);
      }, function (f) {
          return StateT(function (_39) {
              return Prelude["return"](__dict_Monad_6["__superclass_Prelude.Applicative_0"]())(f(_39));
          });
      });
  };
  exports["StateT"] = StateT;
  exports["runStateT"] = runStateT;
  exports["functorStateT"] = functorStateT;
  exports["applyStateT"] = applyStateT;
  exports["applicativeStateT"] = applicativeStateT;
  exports["bindStateT"] = bindStateT;
  exports["monadStateT"] = monadStateT;
  exports["monadStateStateT"] = monadStateStateT;;
 
})(PS["Control.Monad.State.Trans"] = PS["Control.Monad.State.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Tuple = PS["Data.Tuple"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Monad_Cont_Class = PS["Control.Monad.Cont.Class"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Control_Monad_Reader_Class = PS["Control.Monad.Reader.Class"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];     
  var WriterT = function (x) {
      return x;
  };
  var runWriterT = function (_7) {
      return _7;
  };
  var monadTransWriterT = function (__dict_Monoid_5) {
      return new Control_Monad_Trans.MonadTrans(function (__dict_Monad_6) {
          return function (m) {
              return WriterT(Prelude.bind(__dict_Monad_6["__superclass_Prelude.Bind_1"]())(m)(function (_3) {
                  return Prelude["return"](__dict_Monad_6["__superclass_Prelude.Applicative_0"]())(new Data_Tuple.Tuple(_3, Data_Monoid.mempty(__dict_Monoid_5)));
              }));
          };
      });
  };
  var mapWriterT = function (f) {
      return function (m) {
          return WriterT(f(runWriterT(m)));
      };
  };
  var functorWriterT = function (__dict_Functor_22) {
      return new Prelude.Functor(function (f) {
          return mapWriterT(Prelude["<$>"](__dict_Functor_22)(function (_6) {
              return new Data_Tuple.Tuple(f(_6.value0), _6.value1);
          }));
      });
  };
  var applyWriterT = function (__dict_Semigroup_26) {
      return function (__dict_Apply_27) {
          return new Prelude.Apply(function () {
              return functorWriterT(__dict_Apply_27["__superclass_Prelude.Functor_0"]());
          }, function (f) {
              return function (v) {
                  return WriterT((function () {
                      var k = function (_8) {
                          return function (_9) {
                              return new Data_Tuple.Tuple(_8.value0(_9.value0), Prelude["<>"](__dict_Semigroup_26)(_8.value1)(_9.value1));
                          };
                      };
                      return Prelude["<*>"](__dict_Apply_27)(Prelude["<$>"](__dict_Apply_27["__superclass_Prelude.Functor_0"]())(k)(runWriterT(f)))(runWriterT(v));
                  })());
              };
          });
      };
  };
  var bindWriterT = function (__dict_Semigroup_24) {
      return function (__dict_Monad_25) {
          return new Prelude.Bind(function () {
              return applyWriterT(__dict_Semigroup_24)((__dict_Monad_25["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]());
          }, function (m) {
              return function (k) {
                  return WriterT(Prelude.bind(__dict_Monad_25["__superclass_Prelude.Bind_1"]())(runWriterT(m))(function (_1) {
                      return Prelude.bind(__dict_Monad_25["__superclass_Prelude.Bind_1"]())(runWriterT(k(_1.value0)))(function (_0) {
                          return Prelude["return"](__dict_Monad_25["__superclass_Prelude.Applicative_0"]())(new Data_Tuple.Tuple(_0.value0, Prelude["<>"](__dict_Semigroup_24)(_1.value1)(_0.value1)));
                      });
                  }));
              };
          });
      };
  };
  var applicativeWriterT = function (__dict_Monoid_28) {
      return function (__dict_Applicative_29) {
          return new Prelude.Applicative(function () {
              return applyWriterT(__dict_Monoid_28["__superclass_Prelude.Semigroup_0"]())(__dict_Applicative_29["__superclass_Prelude.Apply_0"]());
          }, function (a) {
              return WriterT(Prelude.pure(__dict_Applicative_29)(new Data_Tuple.Tuple(a, Data_Monoid.mempty(__dict_Monoid_28))));
          });
      };
  };
  var monadWriterT = function (__dict_Monoid_3) {
      return function (__dict_Monad_4) {
          return new Prelude.Monad(function () {
              return applicativeWriterT(__dict_Monoid_3)(__dict_Monad_4["__superclass_Prelude.Applicative_0"]());
          }, function () {
              return bindWriterT(__dict_Monoid_3["__superclass_Prelude.Semigroup_0"]())(__dict_Monad_4);
          });
      };
  };
  var monadStateWriterT = function (__dict_Monoid_7) {
      return function (__dict_MonadState_8) {
          return new Control_Monad_State_Class.MonadState(function () {
              return monadWriterT(__dict_Monoid_7)(__dict_MonadState_8["__superclass_Prelude.Monad_0"]());
          }, function (f) {
              return Control_Monad_Trans.lift(monadTransWriterT(__dict_Monoid_7))(__dict_MonadState_8["__superclass_Prelude.Monad_0"]())(Control_Monad_State_Class.state(__dict_MonadState_8)(f));
          });
      };
  };
  exports["WriterT"] = WriterT;
  exports["mapWriterT"] = mapWriterT;
  exports["runWriterT"] = runWriterT;
  exports["functorWriterT"] = functorWriterT;
  exports["applyWriterT"] = applyWriterT;
  exports["applicativeWriterT"] = applicativeWriterT;
  exports["bindWriterT"] = bindWriterT;
  exports["monadWriterT"] = monadWriterT;
  exports["monadTransWriterT"] = monadTransWriterT;
  exports["monadStateWriterT"] = monadStateWriterT;;
 
})(PS["Control.Monad.Writer.Trans"] = PS["Control.Monad.Writer.Trans"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Cont_Trans = PS["Control.Monad.Cont.Trans"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Except_Trans = PS["Control.Monad.Except.Trans"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_List_Trans = PS["Control.Monad.List.Trans"];
  var Control_Monad_Maybe_Trans = PS["Control.Monad.Maybe.Trans"];
  var Control_Monad_Reader_Trans = PS["Control.Monad.Reader.Trans"];
  var Control_Monad_RWS_Trans = PS["Control.Monad.RWS.Trans"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Monoid = PS["Data.Monoid"];     
  var Affable = function (fromAff) {
      this.fromAff = fromAff;
  };
  var fromAff = function (dict) {
      return dict.fromAff;
  };
  var fromEff = function (__dict_Affable_0) {
      return function (eff) {
          return fromAff(__dict_Affable_0)(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(eff));
      };
  };
  var affableFree = function (__dict_Affable_19) {
      return new Affable(function (_8) {
          return Control_Monad_Free.liftF(fromAff(__dict_Affable_19)(_8));
      });
  };
  var affableAff = new Affable(Prelude.id(Prelude.categoryFn));
  exports["Affable"] = Affable;
  exports["fromEff"] = fromEff;
  exports["fromAff"] = fromAff;
  exports["affableAff"] = affableAff;
  exports["affableFree"] = affableFree;;
 
})(PS["Control.Monad.Aff.Free"] = PS["Control.Monad.Aff.Free"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Control.Monad.Eff.Random

  exports.random = Math.random;
 
})(PS["Control.Monad.Eff.Random"] = PS["Control.Monad.Eff.Random"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Int

  exports.fromNumberImpl = function (just) {
    return function (nothing) {
      return function (n) {
        /* jshint bitwise: false */
        return (n | 0) === n ? just(n) : nothing;
      };
    };
  };

  exports.toNumber = function (n) {
    return n;
  };
 
})(PS["Data.Int"] = PS["Data.Int"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Maybe.Unsafe

  exports.unsafeThrow = function (msg) {
    throw new Error(msg);
  };
 
})(PS["Data.Maybe.Unsafe"] = PS["Data.Maybe.Unsafe"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Maybe.Unsafe"];
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];     
  var fromJust = function (_0) {
      if (_0 instanceof Data_Maybe.Just) {
          return _0.value0;
      };
      if (_0 instanceof Data_Maybe.Nothing) {
          return $foreign.unsafeThrow("Data.Maybe.Unsafe.fromJust called on Nothing");
      };
      throw new Error("Failed pattern match at Data.Maybe.Unsafe line 10, column 1 - line 11, column 1: " + [ _0.constructor.name ]);
  };
  exports["fromJust"] = fromJust;;
 
})(PS["Data.Maybe.Unsafe"] = PS["Data.Maybe.Unsafe"] || {});
(function(exports) {
  /* global exports */
  "use strict";          

  exports.floor = Math.floor;
 
})(PS["Math"] = PS["Math"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Math"];
  exports["floor"] = $foreign.floor;;
 
})(PS["Math"] = PS["Math"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Int"];
  var Prelude = PS["Prelude"];
  var Data_Int_Bits = PS["Data.Int.Bits"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_Unsafe = PS["Data.Maybe.Unsafe"];
  var $$Math = PS["Math"];                                                                   
  var fromNumber = $foreign.fromNumberImpl(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var unsafeClamp = function (x) {
      if (x >= $foreign.toNumber(Prelude.top(Prelude.boundedInt))) {
          return Prelude.top(Prelude.boundedInt);
      };
      if (x <= $foreign.toNumber(Prelude.bottom(Prelude.boundedInt))) {
          return Prelude.bottom(Prelude.boundedInt);
      };
      if (Prelude.otherwise) {
          return Data_Maybe_Unsafe.fromJust(fromNumber(x));
      };
      throw new Error("Failed pattern match at Data.Int line 48, column 1 - line 49, column 1: " + [ x.constructor.name ]);
  };
  var floor = function (_2) {
      return unsafeClamp($$Math.floor(_2));
  };
  exports["floor"] = floor;
  exports["fromNumber"] = fromNumber;
  exports["toNumber"] = $foreign.toNumber;;
 
})(PS["Data.Int"] = PS["Data.Int"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Control.Monad.Eff.Random"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Int = PS["Data.Int"];
  var randomInt = function (low) {
      return function (high) {
          return function __do() {
              var _1 = $foreign.random();
              return (function () {
                  var asNumber = ((Data_Int.toNumber(high) - Data_Int.toNumber(low)) + 1) * _1 + Data_Int.toNumber(low);
                  return Prelude["return"](Control_Monad_Eff.applicativeEff)(Data_Int.floor(asNumber));
              })()();
          };
      };
  };
  exports["randomInt"] = randomInt;;
 
})(PS["Control.Monad.Eff.Random"] = PS["Control.Monad.Eff.Random"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];                   
  var runState = function (s) {
      return function (_0) {
          return Data_Identity.runIdentity(Control_Monad_State_Trans.runStateT(s)(_0));
      };
  };
  exports["runState"] = runState;;
 
})(PS["Control.Monad.State"] = PS["Control.Monad.State"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Data_Tuple = PS["Data.Tuple"];     
  var runWriter = function (_0) {
      return Data_Identity.runIdentity(Control_Monad_Writer_Trans.runWriterT(_0));
  };
  exports["runWriter"] = runWriter;;
 
})(PS["Control.Monad.Writer"] = PS["Control.Monad.Writer"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module DOM.Event.EventTarget

  exports.eventListener = function (fn) {
    return function (event) {
      return fn(event)();
    };
  };

  exports.addEventListener = function (type) {
    return function (listener) {
      return function (useCapture) {
        return function (target) {
          return function () {
            target.addEventListener(type, listener, useCapture);
            return {};
          };
        };
      };
    };
  };
 
})(PS["DOM.Event.EventTarget"] = PS["DOM.Event.EventTarget"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["DOM.Event.EventTarget"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var DOM = PS["DOM"];
  var DOM_Event_Types = PS["DOM.Event.Types"];
  exports["addEventListener"] = $foreign.addEventListener;
  exports["eventListener"] = $foreign.eventListener;;
 
})(PS["DOM.Event.EventTarget"] = PS["DOM.Event.EventTarget"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var DOM_Event_Types = PS["DOM.Event.Types"];
  var load = "load";
  exports["load"] = load;;
 
})(PS["DOM.Event.EventTypes"] = PS["DOM.Event.EventTypes"] || {});
(function(exports) {
  /* global exports, window */
  "use strict";

  // module DOM.HTML

  exports.window = function () {
    return window;
  };
 
})(PS["DOM.HTML"] = PS["DOM.HTML"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module DOM.HTML.Types

  exports._readHTMLElement = function (failure) {
    return function (success) {
      return function (value) {
        var tag = Object.prototype.toString.call(value);
        if (tag.indexOf("[object HTML") === 0 && tag.indexOf("Element]") === tag.length - 8) {
          return success(value);
        } else {
          return failure(tag);
        }
      };
    };
  };
 
})(PS["DOM.HTML.Types"] = PS["DOM.HTML.Types"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // jshint maxparams: 1
  exports.toForeign = function (value) {
    return value;
  };
 
})(PS["Data.Foreign"] = PS["Data.Foreign"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.joinWith = function (s) {
    return function (xs) {
      return xs.join(s);
    };
  };
 
})(PS["Data.String"] = PS["Data.String"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.String"];
  var Prelude = PS["Prelude"];
  var Data_Char = PS["Data.Char"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_String_Unsafe = PS["Data.String.Unsafe"];
  exports["joinWith"] = $foreign.joinWith;;
 
})(PS["Data.String"] = PS["Data.String"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Foreign"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Function = PS["Data.Function"];
  var Data_Int = PS["Data.Int"];
  var Data_String = PS["Data.String"];     
  var TypeMismatch = (function () {
      function TypeMismatch(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      TypeMismatch.create = function (value0) {
          return function (value1) {
              return new TypeMismatch(value0, value1);
          };
      };
      return TypeMismatch;
  })();
  exports["TypeMismatch"] = TypeMismatch;
  exports["toForeign"] = $foreign.toForeign;;
 
})(PS["Data.Foreign"] = PS["Data.Foreign"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["DOM.HTML.Types"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Foreign = PS["Data.Foreign"];
  var Data_Foreign_Class = PS["Data.Foreign.Class"];
  var DOM_Event_Types = PS["DOM.Event.Types"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];     
  var windowToEventTarget = Unsafe_Coerce.unsafeCoerce;                        
  var readHTMLElement = $foreign._readHTMLElement(function (_0) {
      return Data_Either.Left.create(Data_Foreign.TypeMismatch.create("HTMLElement")(_0));
  })(Data_Either.Right.create);                                          
  var htmlElementToNode = Unsafe_Coerce.unsafeCoerce;   
  var htmlDocumentToParentNode = Unsafe_Coerce.unsafeCoerce;
  exports["readHTMLElement"] = readHTMLElement;
  exports["htmlElementToNode"] = htmlElementToNode;
  exports["htmlDocumentToParentNode"] = htmlDocumentToParentNode;
  exports["windowToEventTarget"] = windowToEventTarget;;
 
})(PS["DOM.HTML.Types"] = PS["DOM.HTML.Types"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["DOM.HTML"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  exports["window"] = $foreign.window;;
 
})(PS["DOM.HTML"] = PS["DOM.HTML"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module DOM.HTML.Window

  exports.document = function (window) {
    return function () {
      return window.document;
    };
  };
 
})(PS["DOM.HTML.Window"] = PS["DOM.HTML.Window"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["DOM.HTML.Window"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  exports["document"] = $foreign.document;;
 
})(PS["DOM.HTML.Window"] = PS["DOM.HTML.Window"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  exports.appendChild = function (node) {
    return function (parent) {
      return function () {
        return parent.appendChild(node);
      };
    };
  };
 
})(PS["DOM.Node.Node"] = PS["DOM.Node.Node"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Nullable

  exports["null"] = null;

  exports.nullable = function(a, r, f) {
      return a == null ? r : f(a);
  };

  exports.notNull = function(x) {
      return x;
  }; 
 
})(PS["Data.Nullable"] = PS["Data.Nullable"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Nullable"];
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Function = PS["Data.Function"];     
  var toNullable = Data_Maybe.maybe($foreign["null"])($foreign.notNull);
  var toMaybe = function (n) {
      return $foreign.nullable(n, Data_Maybe.Nothing.value, Data_Maybe.Just.create);
  };
  exports["toNullable"] = toNullable;
  exports["toMaybe"] = toMaybe;;
 
})(PS["Data.Nullable"] = PS["Data.Nullable"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["DOM.Node.Node"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Enum = PS["Data.Enum"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Maybe_Unsafe = PS["Data.Maybe.Unsafe"];
  var DOM = PS["DOM"];
  var DOM_Node_NodeType = PS["DOM.Node.NodeType"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  exports["appendChild"] = $foreign.appendChild;;
 
})(PS["DOM.Node.Node"] = PS["DOM.Node.Node"] || {});
(function(exports) {
  /* global exports */
  "use strict";                                               

  exports.querySelector = function (selector) {
    return function (node) {
      return function () {
        return node.querySelector(selector);
      };
    };
  };
 
})(PS["DOM.Node.ParentNode"] = PS["DOM.Node.ParentNode"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["DOM.Node.ParentNode"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Nullable = PS["Data.Nullable"];
  var DOM = PS["DOM"];
  var DOM_Node_Types = PS["DOM.Node.Types"];
  exports["querySelector"] = $foreign.querySelector;;
 
})(PS["DOM.Node.ParentNode"] = PS["DOM.Node.ParentNode"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Array

  //------------------------------------------------------------------------------
  // Array creation --------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.range = function (start) {
    return function (end) {
      var step = start > end ? -1 : 1;
      var result = [];
      for (var i = start, n = 0; i !== end; i += step) {
        result[n++] = i;
      }
      result[n] = i;
      return result;
    };
  };

  exports.replicate = function (n) {
    return function (v) {
      if (n < 1) return [];
      var r = new Array(n);
      for (var i = 0; i < n; i++) r[i] = v;
      return r;
    };
  };

  //------------------------------------------------------------------------------
  // Array size ------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.length = function (xs) {
    return xs.length;
  };

  //------------------------------------------------------------------------------
  // Extending arrays ------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.cons = function (e) {
    return function (l) {
      return [e].concat(l);
    };
  };

  //------------------------------------------------------------------------------
  // Non-indexed reads -----------------------------------------------------------
  //------------------------------------------------------------------------------

  exports["uncons'"] = function (empty) {
    return function (next) {
      return function (xs) {
        return xs.length === 0 ? empty({}) : next(xs[0])(xs.slice(1));
      };
    };
  };

  //------------------------------------------------------------------------------
  // Indexed operations ----------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.indexImpl = function (just) {
    return function (nothing) {
      return function (xs) {
        return function (i) {
          return i < 0 || i >= xs.length ? nothing :  just(xs[i]);
        };
      };
    };
  };

  exports._deleteAt = function (just) {
    return function (nothing) {
      return function (i) {
        return function (l) {
          if (i < 0 || i >= l.length) return nothing;
          var l1 = l.slice();
          l1.splice(i, 1);
          return just(l1);
        };
      };
    };
  };

  exports._updateAt = function (just) {
    return function (nothing) {
      return function (i) {
        return function (a) {
          return function (l) {
            if (i < 0 || i >= l.length) return nothing;
            var l1 = l.slice();
            l1[i] = a;
            return just(l1);
          };
        };
      };
    };
  };

  //------------------------------------------------------------------------------
  // Transformations -------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.reverse = function (l) {
    return l.slice().reverse();
  };

  exports.concat = function (xss) {
    var result = [];
    for (var i = 0, l = xss.length; i < l; i++) {
      var xs = xss[i];
      for (var j = 0, m = xs.length; j < m; j++) {
        result.push(xs[j]);
      }
    }
    return result;
  };

  exports.filter = function (f) {
    return function (xs) {
      return xs.filter(f);
    };
  };

  //------------------------------------------------------------------------------
  // Sorting ---------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.sortImpl = function (f) {
    return function (l) {
      /* jshint maxparams: 2 */
      return l.slice().sort(function (x, y) {
        return f(x)(y);
      });
    };
  };

  //------------------------------------------------------------------------------
  // Subarrays -------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.slice = function (s) {
    return function (e) {
      return function (l) {
        return l.slice(s, e);
      };
    };
  };

  //------------------------------------------------------------------------------
  // Zipping ---------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.zipWith = function (f) {
    return function (xs) {
      return function (ys) {
        var l = xs.length < ys.length ? xs.length : ys.length;
        var result = new Array(l);
        for (var i = 0; i < l; i++) {
          result[i] = f(xs[i])(ys[i]);
        }
        return result;
      };
    };
  };
 
})(PS["Data.Array"] = PS["Data.Array"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Array"];
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Alternative = PS["Control.Alternative"];
  var Control_Lazy = PS["Control.Lazy"];
  var Control_MonadPlus = PS["Control.MonadPlus"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor_Invariant = PS["Data.Functor.Invariant"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Maybe_Unsafe = PS["Data.Maybe.Unsafe"];     
  var $colon = $foreign.cons;
  var $dot$dot = $foreign.range;
  var zip = $foreign.zipWith(Data_Tuple.Tuple.create);
  var updateAt = $foreign._updateAt(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var uncons = $foreign["uncons'"](Prelude["const"](Data_Maybe.Nothing.value))(function (x) {
      return function (xs) {
          return new Data_Maybe.Just({
              head: x, 
              tail: xs
          });
      };
  });                          
  var tail = $foreign["uncons'"](Prelude["const"](Data_Maybe.Nothing.value))(function (_7) {
      return function (xs) {
          return new Data_Maybe.Just(xs);
      };
  });
  var span = function (p) {
      var go = function (__copy_acc) {
          return function (__copy_xs) {
              var acc = __copy_acc;
              var xs = __copy_xs;
              tco: while (true) {
                  var _21 = uncons(xs);
                  if (_21 instanceof Data_Maybe.Just && p(_21.value0.head)) {
                      var __tco_acc = $colon(_21.value0.head)(acc);
                      acc = __tco_acc;
                      xs = _21.value0.tail;
                      continue tco;
                  };
                  return {
                      init: $foreign.reverse(acc), 
                      rest: xs
                  };
              };
          };
      };
      return go([  ]);
  };
  var sortBy = function (comp) {
      return function (xs) {
          var comp$prime = function (x) {
              return function (y) {
                  var _25 = comp(x)(y);
                  if (_25 instanceof Prelude.GT) {
                      return 1;
                  };
                  if (_25 instanceof Prelude.EQ) {
                      return 0;
                  };
                  if (_25 instanceof Prelude.LT) {
                      return -1;
                  };
                  throw new Error("Failed pattern match at Data.Array line 417, column 3 - line 422, column 1: " + [ _25.constructor.name ]);
              };
          };
          return $foreign.sortImpl(comp$prime)(xs);
      };
  };
  var sort = function (__dict_Ord_1) {
      return function (xs) {
          return sortBy(Prelude.compare(__dict_Ord_1))(xs);
      };
  };
  var $$null = function (xs) {
      return $foreign.length(xs) === 0;
  };                                                                                  
  var init = function (xs) {
      if ($$null(xs)) {
          return Data_Maybe.Nothing.value;
      };
      if (Prelude.otherwise) {
          return new Data_Maybe.Just($foreign.slice(0)($foreign.length(xs) - 1)(xs));
      };
      throw new Error("Failed pattern match at Data.Array line 227, column 1 - line 228, column 1: " + [ xs.constructor.name ]);
  };
  var index = $foreign.indexImpl(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var $bang$bang = index;
  var head = $foreign["uncons'"](Prelude["const"](Data_Maybe.Nothing.value))(function (x) {
      return function (_6) {
          return new Data_Maybe.Just(x);
      };
  });
  var groupBy = function (op) {
      var go = function (__copy_acc) {
          return function (__copy_xs) {
              var acc = __copy_acc;
              var xs = __copy_xs;
              tco: while (true) {
                  var _33 = uncons(xs);
                  if (_33 instanceof Data_Maybe.Just) {
                      var sp = span(op(_33.value0.head))(_33.value0.tail);
                      var __tco_acc = $colon($colon(_33.value0.head)(sp.init))(acc);
                      acc = __tco_acc;
                      xs = sp.rest;
                      continue tco;
                  };
                  if (_33 instanceof Data_Maybe.Nothing) {
                      return $foreign.reverse(acc);
                  };
                  throw new Error("Failed pattern match at Data.Array line 484, column 1 - line 485, column 1: " + [ _33.constructor.name ]);
              };
          };
      };
      return go([  ]);
  };
  var group = function (__dict_Eq_8) {
      return function (xs) {
          return groupBy(Prelude.eq(__dict_Eq_8))(xs);
      };
  };
  var group$prime = function (__dict_Ord_9) {
      return function (_47) {
          return group(__dict_Ord_9["__superclass_Prelude.Eq_0"]())(sort(__dict_Ord_9)(_47));
      };
  };
  var deleteAt = $foreign._deleteAt(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
  var alterAt = function (i) {
      return function (f) {
          return function (xs) {
              var go = function (x) {
                  var _45 = f(x);
                  if (_45 instanceof Data_Maybe.Nothing) {
                      return deleteAt(i)(xs);
                  };
                  if (_45 instanceof Data_Maybe.Just) {
                      return updateAt(i)(_45.value0)(xs);
                  };
                  throw new Error("Failed pattern match at Data.Array line 350, column 3 - line 359, column 1: " + [ _45.constructor.name ]);
              };
              return Data_Maybe.maybe(Data_Maybe.Nothing.value)(go)($bang$bang(xs)(i));
          };
      };
  };
  exports["zip"] = zip;
  exports["groupBy"] = groupBy;
  exports["group'"] = group$prime;
  exports["group"] = group;
  exports["span"] = span;
  exports["sortBy"] = sortBy;
  exports["sort"] = sort;
  exports["alterAt"] = alterAt;
  exports["updateAt"] = updateAt;
  exports["deleteAt"] = deleteAt;
  exports["index"] = index;
  exports["uncons"] = uncons;
  exports["init"] = init;
  exports["tail"] = tail;
  exports["head"] = head;
  exports[".."] = $dot$dot;
  exports["filter"] = $foreign.filter;
  exports["length"] = $foreign.length;
  exports["replicate"] = $foreign.replicate;
  exports["range"] = $foreign.range;;
 
})(PS["Data.Array"] = PS["Data.Array"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Unsafe_Coerce = PS["Unsafe.Coerce"];     
  var runExistsR = Unsafe_Coerce.unsafeCoerce;
  var mkExistsR = Unsafe_Coerce.unsafeCoerce;
  exports["runExistsR"] = runExistsR;
  exports["mkExistsR"] = mkExistsR;;
 
})(PS["Data.ExistsR"] = PS["Data.ExistsR"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Data.Generic


  //------------------------------------------------------------------------------
  // Zipping ---------------------------------------------------------------------
  //------------------------------------------------------------------------------

  exports.zipAll = function(f) {
      return function(xs) {
          return function(ys) {
              var l = xs.length < ys.length ? xs.length : ys.length;
              for (var i = 0; i < l; i++) {
                  if (!f(xs[i])(ys[i])) {
                      return false;
                  }
              }
              return true;
          };
      };
  };
 
})(PS["Data.Generic"] = PS["Data.Generic"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Data.Generic"];
  var Prelude = PS["Prelude"];
  var Data_Either = PS["Data.Either"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Array = PS["Data.Array"];
  var Data_String = PS["Data.String"];
  var Type_Proxy = PS["Type.Proxy"];
  var Data_Monoid = PS["Data.Monoid"];     
  var SProd = (function () {
      function SProd(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SProd.create = function (value0) {
          return function (value1) {
              return new SProd(value0, value1);
          };
      };
      return SProd;
  })();
  var SRecord = (function () {
      function SRecord(value0) {
          this.value0 = value0;
      };
      SRecord.create = function (value0) {
          return new SRecord(value0);
      };
      return SRecord;
  })();
  var SNumber = (function () {
      function SNumber(value0) {
          this.value0 = value0;
      };
      SNumber.create = function (value0) {
          return new SNumber(value0);
      };
      return SNumber;
  })();
  var SBoolean = (function () {
      function SBoolean(value0) {
          this.value0 = value0;
      };
      SBoolean.create = function (value0) {
          return new SBoolean(value0);
      };
      return SBoolean;
  })();
  var SInt = (function () {
      function SInt(value0) {
          this.value0 = value0;
      };
      SInt.create = function (value0) {
          return new SInt(value0);
      };
      return SInt;
  })();
  var SString = (function () {
      function SString(value0) {
          this.value0 = value0;
      };
      SString.create = function (value0) {
          return new SString(value0);
      };
      return SString;
  })();
  var SChar = (function () {
      function SChar(value0) {
          this.value0 = value0;
      };
      SChar.create = function (value0) {
          return new SChar(value0);
      };
      return SChar;
  })();
  var SArray = (function () {
      function SArray(value0) {
          this.value0 = value0;
      };
      SArray.create = function (value0) {
          return new SArray(value0);
      };
      return SArray;
  })();
  var SigProd = (function () {
      function SigProd(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SigProd.create = function (value0) {
          return function (value1) {
              return new SigProd(value0, value1);
          };
      };
      return SigProd;
  })();
  var Generic = function (fromSpine, toSignature, toSpine) {
      this.fromSpine = fromSpine;
      this.toSignature = toSignature;
      this.toSpine = toSpine;
  };
  var toSpine = function (dict) {
      return dict.toSpine;
  };
  var toSignature = function (dict) {
      return dict.toSignature;
  };
  var fromSpine = function (dict) {
      return dict.fromSpine;
  };                                                         
  var eqGeneric = new Prelude.Eq(function (_30) {
      return function (_31) {
          if (_30 instanceof SProd && _31 instanceof SProd) {
              return Prelude["=="](Prelude.eqString)(_30.value0)(_31.value0) && (Data_Array.length(_30.value1) === Data_Array.length(_31.value1) && $foreign.zipAll(function (x) {
                  return function (y) {
                      return Prelude["=="](eqGeneric)(x(Prelude.unit))(y(Prelude.unit));
                  };
              })(_30.value1)(_31.value1));
          };
          if (_30 instanceof SRecord && _31 instanceof SRecord) {
              var go = function (x) {
                  return function (y) {
                      return Prelude["=="](Prelude.eqString)(x.recLabel)(y.recLabel) && Prelude["=="](eqGeneric)(x.recValue(Prelude.unit))(y.recValue(Prelude.unit));
                  };
              };
              return Data_Array.length(_30.value0) === Data_Array.length(_31.value0) && $foreign.zipAll(go)(_30.value0)(_31.value0);
          };
          if (_30 instanceof SInt && _31 instanceof SInt) {
              return _30.value0 === _31.value0;
          };
          if (_30 instanceof SNumber && _31 instanceof SNumber) {
              return _30.value0 === _31.value0;
          };
          if (_30 instanceof SBoolean && _31 instanceof SBoolean) {
              return Prelude["=="](Prelude.eqBoolean)(_30.value0)(_31.value0);
          };
          if (_30 instanceof SChar && _31 instanceof SChar) {
              return Prelude["=="](Prelude.eqChar)(_30.value0)(_31.value0);
          };
          if (_30 instanceof SString && _31 instanceof SString) {
              return Prelude["=="](Prelude.eqString)(_30.value0)(_31.value0);
          };
          if (_30 instanceof SArray && _31 instanceof SArray) {
              return Data_Array.length(_30.value0) === Data_Array.length(_31.value0) && $foreign.zipAll(function (x) {
                  return function (y) {
                      return Prelude["=="](eqGeneric)(x(Prelude.unit))(y(Prelude.unit));
                  };
              })(_30.value0)(_31.value0);
          };
          return false;
      };
  });
  var gEq = function (__dict_Generic_1) {
      return function (x) {
          return function (y) {
              return Prelude["=="](eqGeneric)(toSpine(__dict_Generic_1)(x))(toSpine(__dict_Generic_1)(y));
          };
      };
  };
  exports["SigProd"] = SigProd;
  exports["SProd"] = SProd;
  exports["SRecord"] = SRecord;
  exports["SNumber"] = SNumber;
  exports["SBoolean"] = SBoolean;
  exports["SInt"] = SInt;
  exports["SString"] = SString;
  exports["SChar"] = SChar;
  exports["SArray"] = SArray;
  exports["Generic"] = Generic;
  exports["gEq"] = gEq;
  exports["fromSpine"] = fromSpine;
  exports["toSignature"] = toSignature;
  exports["toSpine"] = toSpine;
  exports["eqGeneric"] = eqGeneric;;
 
})(PS["Data.Generic"] = PS["Data.Generic"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Coroutine_Aff = PS["Control.Coroutine.Aff"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Aff_Class = PS["Control.Monad.Aff.Class"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Data_Const = PS["Data.Const"];
  var Data_Either = PS["Data.Either"];
  var Data_Functor_Coproduct = PS["Data.Functor.Coproduct"];
  var Data_Maybe = PS["Data.Maybe"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];             
  var runEventSource = function (_0) {
      return _0;
  };
  exports["runEventSource"] = runEventSource;;
 
})(PS["Halogen.Query.EventSource"] = PS["Halogen.Query.EventSource"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Prelude = PS["Prelude"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Data_Functor = PS["Data.Functor"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];     
  var Get = (function () {
      function Get(value0) {
          this.value0 = value0;
      };
      Get.create = function (value0) {
          return new Get(value0);
      };
      return Get;
  })();
  var Modify = (function () {
      function Modify(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Modify.create = function (value0) {
          return function (value1) {
              return new Modify(value0, value1);
          };
      };
      return Modify;
  })();
  var stateN = function (__dict_Monad_0) {
      return function (__dict_MonadState_1) {
          return function (_3) {
              if (_3 instanceof Get) {
                  return Prelude[">>="](__dict_Monad_0["__superclass_Prelude.Bind_1"]())(Control_Monad_State_Class.get(__dict_MonadState_1))(function (_20) {
                      return Prelude.pure(__dict_Monad_0["__superclass_Prelude.Applicative_0"]())(_3.value0(_20));
                  });
              };
              if (_3 instanceof Modify) {
                  return Data_Functor["$>"](((__dict_Monad_0["__superclass_Prelude.Bind_1"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Control_Monad_State_Class.modify(__dict_MonadState_1)(_3.value0))(_3.value1);
              };
              throw new Error("Failed pattern match at Halogen.Query.StateF line 33, column 1 - line 34, column 1: " + [ _3.constructor.name ]);
          };
      };
  };
  var functorStateF = new Prelude.Functor(function (f) {
      return function (_4) {
          if (_4 instanceof Get) {
              return new Get(function (_22) {
                  return f(_4.value0(_22));
              });
          };
          if (_4 instanceof Modify) {
              return new Modify(_4.value0, f(_4.value1));
          };
          throw new Error("Failed pattern match at Halogen.Query.StateF line 21, column 1 - line 27, column 1: " + [ f.constructor.name, _4.constructor.name ]);
      };
  });
  exports["Get"] = Get;
  exports["Modify"] = Modify;
  exports["stateN"] = stateN;
  exports["functorStateF"] = functorStateF;;
 
})(PS["Halogen.Query.StateF"] = PS["Halogen.Query.StateF"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];     
  var StateHF = (function () {
      function StateHF(value0) {
          this.value0 = value0;
      };
      StateHF.create = function (value0) {
          return new StateHF(value0);
      };
      return StateHF;
  })();
  var SubscribeHF = (function () {
      function SubscribeHF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      SubscribeHF.create = function (value0) {
          return function (value1) {
              return new SubscribeHF(value0, value1);
          };
      };
      return SubscribeHF;
  })();
  var QueryHF = (function () {
      function QueryHF(value0) {
          this.value0 = value0;
      };
      QueryHF.create = function (value0) {
          return new QueryHF(value0);
      };
      return QueryHF;
  })();
  var HaltHF = (function () {
      function HaltHF() {

      };
      HaltHF.value = new HaltHF();
      return HaltHF;
  })();
  var functorHalogenF = function (__dict_Functor_3) {
      return new Prelude.Functor(function (f) {
          return function (h) {
              if (h instanceof StateHF) {
                  return new StateHF(Prelude.map(Halogen_Query_StateF.functorStateF)(f)(h.value0));
              };
              if (h instanceof SubscribeHF) {
                  return new SubscribeHF(h.value0, f(h.value1));
              };
              if (h instanceof QueryHF) {
                  return new QueryHF(Prelude.map(__dict_Functor_3)(f)(h.value0));
              };
              if (h instanceof HaltHF) {
                  return HaltHF.value;
              };
              throw new Error("Failed pattern match at Halogen.Query.HalogenF line 30, column 1 - line 38, column 1: " + [ h.constructor.name ]);
          };
      });
  };
  var affableHalogenF = function (__dict_Affable_5) {
      return new Control_Monad_Aff_Free.Affable(function (_18) {
          return QueryHF.create(Control_Monad_Aff_Free.fromAff(__dict_Affable_5)(_18));
      });
  };
  exports["StateHF"] = StateHF;
  exports["SubscribeHF"] = SubscribeHF;
  exports["QueryHF"] = QueryHF;
  exports["HaltHF"] = HaltHF;
  exports["functorHalogenF"] = functorHalogenF;
  exports["affableHalogenF"] = affableHalogenF;;
 
})(PS["Halogen.Query.HalogenF"] = PS["Halogen.Query.HalogenF"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];     
  var PostRender = (function () {
      function PostRender(value0) {
          this.value0 = value0;
      };
      PostRender.create = function (value0) {
          return new PostRender(value0);
      };
      return PostRender;
  })();
  var Finalized = (function () {
      function Finalized(value0) {
          this.value0 = value0;
      };
      Finalized.create = function (value0) {
          return new Finalized(value0);
      };
      return Finalized;
  })();
  var FinalizedF = (function () {
      function FinalizedF(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      FinalizedF.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new FinalizedF(value0, value1, value2);
              };
          };
      };
      return FinalizedF;
  })();
  var runFinalized = function (k) {
      return function (f) {
          var _2 = Unsafe_Coerce.unsafeCoerce(f);
          return k(_2.value0)(_2.value1)(_2.value2);
      };
  };
  var finalized = function (e) {
      return function (s) {
          return function (i) {
              return Unsafe_Coerce.unsafeCoerce(new FinalizedF(e, s, i));
          };
      };
  };
  exports["PostRender"] = PostRender;
  exports["Finalized"] = Finalized;
  exports["runFinalized"] = runFinalized;
  exports["finalized"] = finalized;;
 
})(PS["Halogen.Component.Hook"] = PS["Halogen.Component.Hook"] || {});
(function(exports) {
  /* global exports */
  "use strict";

  // module Halogen.HTML.Events.Handler

  exports.preventDefaultImpl = function (e) {
    return function () {
      e.preventDefault();
    };
  };

  exports.stopPropagationImpl = function (e) {
    return function () {
      e.stopPropagation();
    };
  };

  exports.stopImmediatePropagationImpl = function (e) {
    return function () {
      e.stopImmediatePropagation();
    };
  };
 
})(PS["Halogen.HTML.Events.Handler"] = PS["Halogen.HTML.Events.Handler"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Halogen.HTML.Events.Handler"];
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Writer = PS["Control.Monad.Writer"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM = PS["DOM"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Data_Monoid = PS["Data.Monoid"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Identity = PS["Data.Identity"];     
  var PreventDefault = (function () {
      function PreventDefault() {

      };
      PreventDefault.value = new PreventDefault();
      return PreventDefault;
  })();
  var StopPropagation = (function () {
      function StopPropagation() {

      };
      StopPropagation.value = new StopPropagation();
      return StopPropagation;
  })();
  var StopImmediatePropagation = (function () {
      function StopImmediatePropagation() {

      };
      StopImmediatePropagation.value = new StopImmediatePropagation();
      return StopImmediatePropagation;
  })();
  var EventHandler = function (x) {
      return x;
  };                                                                                                                                                                                                                                                                                                                              
  var runEventHandler = function (__dict_Monad_0) {
      return function (__dict_MonadEff_1) {
          return function (e) {
              return function (_1) {
                  var applyUpdate = function (_6) {
                      if (_6 instanceof PreventDefault) {
                          return $foreign.preventDefaultImpl(e);
                      };
                      if (_6 instanceof StopPropagation) {
                          return $foreign.stopPropagationImpl(e);
                      };
                      if (_6 instanceof StopImmediatePropagation) {
                          return $foreign.stopImmediatePropagationImpl(e);
                      };
                      throw new Error("Failed pattern match at Halogen.HTML.Events.Handler line 88, column 3 - line 89, column 3: " + [ _6.constructor.name ]);
                  };
                  var _11 = Control_Monad_Writer.runWriter(_1);
                  return Control_Monad_Eff_Class.liftEff(__dict_MonadEff_1)(Control_Apply["*>"](Control_Monad_Eff.applyEff)(Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)(_11.value1)(applyUpdate))(Prelude["return"](Control_Monad_Eff.applicativeEff)(_11.value0)));
              };
          };
      };
  };                                                                                                                                                                                                                                                                                                          
  var functorEventHandler = new Prelude.Functor(function (f) {
      return function (_2) {
          return Prelude["<$>"](Control_Monad_Writer_Trans.functorWriterT(Data_Identity.functorIdentity))(f)(_2);
      };
  });
  var applyEventHandler = new Prelude.Apply(function () {
      return functorEventHandler;
  }, function (_3) {
      return function (_4) {
          return Prelude["<*>"](Control_Monad_Writer_Trans.applyWriterT(Prelude.semigroupArray)(Data_Identity.applyIdentity))(_3)(_4);
      };
  });
  var applicativeEventHandler = new Prelude.Applicative(function () {
      return applyEventHandler;
  }, function (_21) {
      return EventHandler(Prelude.pure(Control_Monad_Writer_Trans.applicativeWriterT(Data_Monoid.monoidArray)(Data_Identity.applicativeIdentity))(_21));
  });
  exports["runEventHandler"] = runEventHandler;
  exports["functorEventHandler"] = functorEventHandler;
  exports["applyEventHandler"] = applyEventHandler;
  exports["applicativeEventHandler"] = applicativeEventHandler;;
 
})(PS["Halogen.HTML.Events.Handler"] = PS["Halogen.HTML.Events.Handler"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Exists = PS["Data.Exists"];
  var Data_ExistsR = PS["Data.ExistsR"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];     
  var TagName = function (x) {
      return x;
  };
  var PropName = function (x) {
      return x;
  };
  var EventName = function (x) {
      return x;
  };
  var HandlerF = (function () {
      function HandlerF(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      HandlerF.create = function (value0) {
          return function (value1) {
              return new HandlerF(value0, value1);
          };
      };
      return HandlerF;
  })();
  var ClassName = function (x) {
      return x;
  };
  var AttrName = function (x) {
      return x;
  };
  var PropF = (function () {
      function PropF(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      PropF.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new PropF(value0, value1, value2);
              };
          };
      };
      return PropF;
  })();
  var Prop = (function () {
      function Prop(value0) {
          this.value0 = value0;
      };
      Prop.create = function (value0) {
          return new Prop(value0);
      };
      return Prop;
  })();
  var Attr = (function () {
      function Attr(value0, value1, value2) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
      };
      Attr.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return new Attr(value0, value1, value2);
              };
          };
      };
      return Attr;
  })();
  var Key = (function () {
      function Key(value0) {
          this.value0 = value0;
      };
      Key.create = function (value0) {
          return new Key(value0);
      };
      return Key;
  })();
  var Handler = (function () {
      function Handler(value0) {
          this.value0 = value0;
      };
      Handler.create = function (value0) {
          return new Handler(value0);
      };
      return Handler;
  })();
  var Ref = (function () {
      function Ref(value0) {
          this.value0 = value0;
      };
      Ref.create = function (value0) {
          return new Ref(value0);
      };
      return Ref;
  })();
  var Text = (function () {
      function Text(value0) {
          this.value0 = value0;
      };
      Text.create = function (value0) {
          return new Text(value0);
      };
      return Text;
  })();
  var Element = (function () {
      function Element(value0, value1, value2, value3) {
          this.value0 = value0;
          this.value1 = value1;
          this.value2 = value2;
          this.value3 = value3;
      };
      Element.create = function (value0) {
          return function (value1) {
              return function (value2) {
                  return function (value3) {
                      return new Element(value0, value1, value2, value3);
                  };
              };
          };
      };
      return Element;
  })();
  var Slot = (function () {
      function Slot(value0) {
          this.value0 = value0;
      };
      Slot.create = function (value0) {
          return new Slot(value0);
      };
      return Slot;
  })();
  var IsProp = function (toPropString) {
      this.toPropString = toPropString;
  };
  var toPropString = function (dict) {
      return dict.toPropString;
  };
  var tagName = TagName;
  var stringIsProp = new IsProp(function (_10) {
      return function (_11) {
          return function (s) {
              return s;
          };
      };
  });
  var runTagName = function (_3) {
      return _3;
  };
  var runPropName = function (_4) {
      return _4;
  };
  var runNamespace = function (_2) {
      return _2;
  };
  var runEventName = function (_6) {
      return _6;
  };
  var runClassName = function (_7) {
      return _7;
  };
  var runAttrName = function (_5) {
      return _5;
  };
  var propName = PropName;
  var prop = function (__dict_IsProp_0) {
      return function (name) {
          return function (attr) {
              return function (v) {
                  return new Prop(Data_Exists.mkExists(new PropF(name, v, Prelude["<$>"](Data_Maybe.functorMaybe)(Prelude.flip(Data_Tuple.Tuple.create)(toPropString(__dict_IsProp_0)))(attr))));
              };
          };
      };
  };
  var handler = function (name) {
      return function (k) {
          return new Handler(Data_ExistsR.mkExistsR(new HandlerF(name, function (_55) {
              return Prelude.map(Halogen_HTML_Events_Handler.functorEventHandler)(Data_Maybe.Just.create)(k(_55));
          })));
      };
  };
  var eventName = EventName;
  var element = Element.create(Data_Maybe.Nothing.value);
  var className = ClassName;
  var booleanIsProp = new IsProp(function (name) {
      return function (_16) {
          return function (_17) {
              if (_17) {
                  return runAttrName(name);
              };
              if (!_17) {
                  return "";
              };
              throw new Error("Failed pattern match at Halogen.HTML.Core line 142, column 1 - line 147, column 1: " + [ name.constructor.name, _16.constructor.name, _17.constructor.name ]);
          };
      };
  });                                                                       
  var attrName = AttrName;
  exports["HandlerF"] = HandlerF;
  exports["PropF"] = PropF;
  exports["Prop"] = Prop;
  exports["Attr"] = Attr;
  exports["Key"] = Key;
  exports["Handler"] = Handler;
  exports["Ref"] = Ref;
  exports["Text"] = Text;
  exports["Element"] = Element;
  exports["Slot"] = Slot;
  exports["IsProp"] = IsProp;
  exports["runClassName"] = runClassName;
  exports["className"] = className;
  exports["runEventName"] = runEventName;
  exports["eventName"] = eventName;
  exports["runAttrName"] = runAttrName;
  exports["attrName"] = attrName;
  exports["runPropName"] = runPropName;
  exports["propName"] = propName;
  exports["runTagName"] = runTagName;
  exports["tagName"] = tagName;
  exports["runNamespace"] = runNamespace;
  exports["toPropString"] = toPropString;
  exports["handler"] = handler;
  exports["prop"] = prop;
  exports["element"] = element;
  exports["stringIsProp"] = stringIsProp;
  exports["booleanIsProp"] = booleanIsProp;;
 
})(PS["Halogen.HTML.Core"] = PS["Halogen.HTML.Core"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];     
  var runTree = function (k) {
      return function (t) {
          var _3 = Unsafe_Coerce.unsafeCoerce(t);
          return k(_3);
      };
  };
  var mkTree$prime = Unsafe_Coerce.unsafeCoerce;
  exports["runTree"] = runTree;
  exports["mkTree'"] = mkTree$prime;;
 
})(PS["Halogen.Component.Tree"] = PS["Halogen.Component.Tree"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Alt = PS["Control.Alt"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var modify = function (f) {
      return Control_Monad_Free.liftF(new Halogen_Query_HalogenF.StateHF(new Halogen_Query_StateF.Modify(f, Prelude.unit)));
  };                                             
  var action = function (act) {
      return act(Prelude.unit);
  };
  exports["modify"] = modify;
  exports["action"] = action;;
 
})(PS["Halogen.Query"] = PS["Halogen.Query"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Control_Monad_State_Class = PS["Control.Monad.State.Class"];
  var Control_Monad_Writer_Class = PS["Control.Monad.Writer.Class"];
  var Prelude = PS["Prelude"];
  var Control_Apply = PS["Control.Apply"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Control_Monad_Writer_Trans = PS["Control.Monad.Writer.Trans"];
  var Data_Bifunctor = PS["Data.Bifunctor"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Functor_Coproduct = PS["Data.Functor.Coproduct"];
  var Data_List = PS["Data.List"];
  var Data_Map = PS["Data.Map"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Maybe_Unsafe = PS["Data.Maybe.Unsafe"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Data_Void = PS["Data.Void"];
  var Halogen_Component_ChildPath = PS["Halogen.Component.ChildPath"];
  var Halogen_Component_Hook = PS["Halogen.Component.Hook"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Data_Monoid = PS["Data.Monoid"];
  var renderComponent = function (_22) {
      return function (s) {
          var _57 = Control_Monad_State.runState(Control_Monad_Writer_Trans.runWriterT(_22.render))(s);
          return {
              tree: _57.value0.value0, 
              hooks: _57.value0.value1, 
              state: _57.value1
          };
      };
  };
  var queryComponent = function (_23) {
      return _23["eval"];
  };
  var lifecycleComponent = function (spec) {
      var renderTree = function (html) {
          return Halogen_Component_Tree["mkTree'"]({
              slot: Prelude.unit, 
              html: Unsafe_Coerce.unsafeCoerce(html), 
              eq: function (_7) {
                  return function (_6) {
                      return false;
                  };
              }, 
              thunk: false
          });
      };
      return {
          render: Prelude["<$>"](Control_Monad_Writer_Trans.functorWriterT(Control_Monad_State_Trans.functorStateT(Data_Identity.monadIdentity)))(renderTree)(Control_Monad_State_Class.gets(Control_Monad_Writer_Trans.monadStateWriterT(Data_Monoid.monoidArray)(Control_Monad_State_Trans.monadStateStateT(Data_Identity.monadIdentity)))(spec.render)), 
          "eval": spec["eval"], 
          initializer: spec.initializer, 
          finalizers: function (s) {
              return Data_Maybe.maybe([  ])(function (i) {
                  return [ Halogen_Component_Hook.finalized(spec["eval"])(s)(i) ];
              })(spec.finalizer);
          }
      };
  };
  var initializeComponent = function (_24) {
      return _24.initializer;
  };
  var component = function (spec) {
      return lifecycleComponent({
          render: spec.render, 
          "eval": spec["eval"], 
          initializer: Data_Maybe.Nothing.value, 
          finalizer: Data_Maybe.Nothing.value
      });
  };
  exports["initializeComponent"] = initializeComponent;
  exports["queryComponent"] = queryComponent;
  exports["renderComponent"] = renderComponent;
  exports["lifecycleComponent"] = lifecycleComponent;
  exports["component"] = component;;
 
})(PS["Halogen.Component"] = PS["Halogen.Component"] || {});
(function(exports) {
  /* global exports, require */
  "use strict";

  // module Halogen.Internal.VirtualDOM

  var vcreateElement = require("virtual-dom/create-element");
  var vdiff = require("virtual-dom/diff");
  var vpatch = require("virtual-dom/patch");
  var VText = require("virtual-dom/vnode/vtext");
  var VirtualNode = require("virtual-dom/vnode/vnode");
  var SoftSetHook = require("virtual-dom/virtual-hyperscript/hooks/soft-set-hook");

  // jshint maxparams: 2
  exports.prop = function (key, value) {
    var props = {};
    props[key] = value;
    return props;
  };

  // jshint maxparams: 2
  exports.attr = function (key, value) {
    var props = { attributes: {} };
    props.attributes[key] = value;
    return props;
  };

  function HandlerHook (key, f) {
    this.key = key;
    this.callback = function (e) {
      f(e)();
    };
  }

  HandlerHook.prototype = {
    hook: function (node) {
      node.addEventListener(this.key, this.callback);
    },
    unhook: function (node) {
      node.removeEventListener(this.key, this.callback);
    }
  };

  // jshint maxparams: 2
  exports.handlerProp = function (key, f) {
    var props = {};
    props["halogen-hook-" + key] = new HandlerHook(key, f);
    return props;
  };

  exports.refPropImpl = function (nothing) {
    return function (just) {

      var ifHookFn = function (init) {
        // jshint maxparams: 3
        return function (node, prop, diff) {
          // jshint validthis: true
          if (typeof diff === "undefined") {
            this.f(init ? just(node) : nothing)();
          }
        };
      };

      // jshint maxparams: 1
      function RefHook (f) {
        this.f = f;
      }

      RefHook.prototype = {
        hook: ifHookFn(true),
        unhook: ifHookFn(false)
      };

      return function (f) {
        return { "halogen-ref": new RefHook(f) };
      };
    };
  };

  // jshint maxparams: 3
  function HalogenWidget (tree, eq, render) {
    this.tree = tree;
    this.eq = eq;
    this.render = render;
    this.vdom = null;
    this.el = null;
  }

  HalogenWidget.prototype = {
    type: "Widget",
    init: function () {
      this.vdom = this.render(this.tree);
      this.el = vcreateElement(this.vdom);
      return this.el;
    },
    update: function (prev, node) {
      if (!prev.tree || !this.eq(prev.tree.slot)(this.tree.slot)) {
        return this.init();
      }
      if (this.tree.thunk) {
        this.vdom = prev.vdom;
        this.el = prev.el;
      } else {
        this.vdom = this.render(this.tree);
        this.el = vpatch(node, vdiff(prev.vdom, this.vdom));
      }
    }
  };

  exports.widget = function (tree) {
    return function (eq) {
      return function (render) {
        return new HalogenWidget(tree, eq, render);
      };
    };
  };

  exports.concatProps = function () {
    // jshint maxparams: 2
    var hOP = Object.prototype.hasOwnProperty;
    var copy = function (props, result) {
      for (var key in props) {
        if (hOP.call(props, key)) {
          if (key === "attributes") {
            var attrs = props[key];
            var resultAttrs = result[key] || (result[key] = {});
            for (var attr in attrs) {
              if (hOP.call(attrs, attr)) {
                resultAttrs[attr] = attrs[attr];
              }
            }
          } else {
            result[key] = props[key];
          }
        }
      }
      return result;
    };
    return function (p1, p2) {
      return copy(p2, copy(p1, {}));
    };
  }();

  exports.emptyProps = {};

  exports.createElement = function (vtree) {
    return vcreateElement(vtree);
  };

  exports.diff = function (vtree1) {
    return function (vtree2) {
      return vdiff(vtree1, vtree2);
    };
  };

  exports.patch = function (p) {
    return function (node) {
      return function () {
        return vpatch(node, p);
      };
    };
  };

  exports.vtext = function (s) {
    return new VText(s);
  };

  exports.vnode = function (namespace) {
    return function (name) {
      return function (key) {
        return function (props) {
          return function (children) {
            if (name === "input" && props.value !== undefined) {
              props.value = new SoftSetHook(props.value);
            }
            return new VirtualNode(name, props, children, key, namespace);
          };
        };
      };
    };
  };
 
})(PS["Halogen.Internal.VirtualDOM"] = PS["Halogen.Internal.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var $foreign = PS["Halogen.Internal.VirtualDOM"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Function = PS["Data.Function"];
  var DOM = PS["DOM"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];     
  var semigroupProps = new Prelude.Semigroup(Data_Function.runFn2($foreign.concatProps));
  var refProp = $foreign.refPropImpl(Data_Maybe.Nothing.value)(Data_Maybe.Just.create);
  var monoidProps = new Data_Monoid.Monoid(function () {
      return semigroupProps;
  }, $foreign.emptyProps);
  exports["refProp"] = refProp;
  exports["semigroupProps"] = semigroupProps;
  exports["monoidProps"] = monoidProps;
  exports["vnode"] = $foreign.vnode;
  exports["vtext"] = $foreign.vtext;
  exports["patch"] = $foreign.patch;
  exports["diff"] = $foreign.diff;
  exports["createElement"] = $foreign.createElement;
  exports["widget"] = $foreign.widget;
  exports["handlerProp"] = $foreign.handlerProp;
  exports["attr"] = $foreign.attr;
  exports["prop"] = $foreign.prop;;
 
})(PS["Halogen.Internal.VirtualDOM"] = PS["Halogen.Internal.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Data_Exists = PS["Data.Exists"];
  var Data_ExistsR = PS["Data.ExistsR"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Function = PS["Data.Function"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Monoid = PS["Data.Monoid"];
  var Data_Nullable = PS["Data.Nullable"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Halogen_Component_Tree = PS["Halogen.Component.Tree"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_Internal_VirtualDOM = PS["Halogen.Internal.VirtualDOM"];     
  var handleAff = Control_Monad_Aff.runAff(Control_Monad_Eff_Exception.throwException)(Prelude["const"](Prelude.pure(Control_Monad_Eff.applicativeEff)(Prelude.unit)));
  var renderProp = function (dr) {
      return function (_2) {
          if (_2 instanceof Halogen_HTML_Core.Prop) {
              return Data_Exists.runExists(function (_0) {
                  return Halogen_Internal_VirtualDOM.prop(Halogen_HTML_Core.runPropName(_0.value0), _0.value1);
              })(_2.value0);
          };
          if (_2 instanceof Halogen_HTML_Core.Attr) {
              var attrName = Data_Maybe.maybe("")(function (ns$prime) {
                  return Halogen_HTML_Core.runNamespace(ns$prime) + ":";
              })(_2.value0) + Halogen_HTML_Core.runAttrName(_2.value1);
              return Halogen_Internal_VirtualDOM.attr(attrName, _2.value2);
          };
          if (_2 instanceof Halogen_HTML_Core.Handler) {
              return Data_ExistsR.runExistsR(function (_1) {
                  return Halogen_Internal_VirtualDOM.handlerProp(Halogen_HTML_Core.runEventName(_1.value0), function (ev) {
                      return handleAff(Prelude[">>="](Control_Monad_Aff.bindAff)(Halogen_HTML_Events_Handler.runEventHandler(Control_Monad_Aff.monadAff)(Control_Monad_Aff.monadEffAff)(ev)(_1.value1(ev)))(Data_Maybe.maybe(Prelude.pure(Control_Monad_Aff.applicativeAff)(Prelude.unit))(dr)));
                  });
              })(_2.value0);
          };
          if (_2 instanceof Halogen_HTML_Core.Ref) {
              return Halogen_Internal_VirtualDOM.refProp(function (_38) {
                  return handleAff(dr(_2.value0(_38)));
              });
          };
          return Data_Monoid.mempty(Halogen_Internal_VirtualDOM.monoidProps);
      };
  };
  var findKey = function (r) {
      return function (_3) {
          if (_3 instanceof Halogen_HTML_Core.Key) {
              return new Data_Maybe.Just(_3.value0);
          };
          return r;
      };
  };
  var renderTree = function (f) {
      return Halogen_Component_Tree.runTree(function (tree) {
          var go = function (_5) {
              if (_5 instanceof Halogen_HTML_Core.Text) {
                  return Halogen_Internal_VirtualDOM.vtext(_5.value0);
              };
              if (_5 instanceof Halogen_HTML_Core.Slot) {
                  return Halogen_Internal_VirtualDOM.widget(_5.value0)(tree.eq)(renderTree(f));
              };
              if (_5 instanceof Halogen_HTML_Core.Element) {
                  var tag = Halogen_HTML_Core.runTagName(_5.value1);
                  var ns$prime = Data_Nullable.toNullable(Prelude["<$>"](Data_Maybe.functorMaybe)(Halogen_HTML_Core.runNamespace)(_5.value0));
                  var key = Data_Nullable.toNullable(Data_Foldable.foldl(Data_Foldable.foldableArray)(findKey)(Data_Maybe.Nothing.value)(_5.value2));
                  return Halogen_Internal_VirtualDOM.vnode(ns$prime)(tag)(key)(Data_Foldable.foldMap(Data_Foldable.foldableArray)(Halogen_Internal_VirtualDOM.monoidProps)(renderProp(f))(_5.value2))(Prelude.map(Prelude.functorArray)(go)(_5.value3));
              };
              throw new Error("Failed pattern match: " + [ _5.constructor.name ]);
          };
          return go(tree.html);
      });
  };
  exports["renderTree"] = renderTree;;
 
})(PS["Halogen.HTML.Renderer.VirtualDOM"] = PS["Halogen.HTML.Renderer.VirtualDOM"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Coroutine = PS["Control.Coroutine"];
  var Control_Coroutine_Stalling = PS["Control.Coroutine.Stalling"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_AVar = PS["Control.Monad.Aff.AVar"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Control_Monad_Rec_Class = PS["Control.Monad.Rec.Class"];
  var Control_Monad_State = PS["Control.Monad.State"];
  var Control_Monad_Trans = PS["Control.Monad.Trans"];
  var Control_Plus = PS["Control.Plus"];
  var Data_Either = PS["Data.Either"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_List = PS["Data.List"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_NaturalTransformation = PS["Data.NaturalTransformation"];
  var Data_Tuple = PS["Data.Tuple"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var DOM_Node_Node = PS["DOM.Node.Node"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Component_Hook = PS["Halogen.Component.Hook"];
  var Halogen_Effects = PS["Halogen.Effects"];
  var Halogen_HTML_Renderer_VirtualDOM = PS["Halogen.HTML.Renderer.VirtualDOM"];
  var Halogen_Internal_VirtualDOM = PS["Halogen.Internal.VirtualDOM"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Query_EventSource = PS["Halogen.Query.EventSource"];
  var Halogen_Query_StateF = PS["Halogen.Query.StateF"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];
  var Control_Monad_State_Trans = PS["Control.Monad.State.Trans"];
  var Data_Identity = PS["Data.Identity"];
  var Control_Monad_Free_Trans = PS["Control.Monad.Free.Trans"];     
  var onInitializers = function (__dict_Foldable_0) {
      return function (f) {
          var go = function (_11) {
              return function (as) {
                  if (_11 instanceof Halogen_Component_Hook.PostRender) {
                      return Data_List[":"](f(_11.value0))(as);
                  };
                  return as;
              };
          };
          return Data_Foldable.foldr(__dict_Foldable_0)(go)(Data_List.Nil.value);
      };
  };
  var onFinalizers = function (__dict_Foldable_1) {
      return function (f) {
          var go = function (_12) {
              return function (as) {
                  if (_12 instanceof Halogen_Component_Hook.Finalized) {
                      return Data_List[":"](f(_12.value0))(as);
                  };
                  return as;
              };
          };
          return Data_Foldable.foldr(__dict_Foldable_1)(go)(Data_List.Nil.value);
      };
  };
  var runUI = function (c) {
      return function (s) {
          return function (element) {
              var driver$prime = function (e) {
                  return function (s_1) {
                      return function (i) {
                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar["makeVar'"](s_1))(function (_6) {
                              return Prelude.flip(Control_Monad_Free.runFreeM(Halogen_Query_HalogenF.functorHalogenF(Control_Monad_Aff.functorAff))(Control_Monad_Aff.monadRecAff))(e(i))(function (h) {
                                  if (h instanceof Halogen_Query_HalogenF.StateHF) {
                                      return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(_6))(function (_5) {
                                          var _22 = Control_Monad_State.runState(Halogen_Query_StateF.stateN(Control_Monad_State_Trans.monadStateT(Data_Identity.monadIdentity))(Control_Monad_State_Trans.monadStateStateT(Data_Identity.monadIdentity))(h.value0))(_5);
                                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(_6)(_22.value1))(function () {
                                              return Prelude.pure(Control_Monad_Aff.applicativeAff)(_22.value0);
                                          });
                                      });
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.SubscribeHF) {
                                      return Prelude.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.QueryHF) {
                                      return h.value0;
                                  };
                                  if (h instanceof Halogen_Query_HalogenF.HaltHF) {
                                      return Control_Plus.empty(Control_Monad_Aff.plusAff);
                                  };
                                  throw new Error("Failed pattern match at Halogen.Driver line 119, column 3 - line 125, column 3: " + [ h.constructor.name ]);
                              });
                          });
                      };
                  };
              };
              var render = function (ref) {
                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (_8) {
                      var _30 = _8.renderPaused || !_8.renderPending;
                      if (_30) {
                          return Control_Monad_Aff_AVar.putVar(ref)(_8);
                      };
                      if (!_30) {
                          var rc = Halogen_Component.renderComponent(c)(_8.state);
                          var vtree$prime = Halogen_HTML_Renderer_VirtualDOM.renderTree(driver(ref))(rc.tree);
                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(Halogen_Internal_VirtualDOM.patch(Halogen_Internal_VirtualDOM.diff(_8.vtree)(vtree$prime))(_8.node)))(function (_7) {
                              return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)({
                                  node: _7, 
                                  vtree: vtree$prime, 
                                  state: rc.state, 
                                  renderPending: false, 
                                  renderPaused: true
                              }))(function () {
                                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff.forkAll(Data_List.foldableList)(onFinalizers(Data_Foldable.foldableArray)(Halogen_Component_Hook.runFinalized(driver$prime))(rc.hooks)))(function () {
                                      return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff.forkAll(Data_List.foldableList)(onInitializers(Data_Foldable.foldableArray)(driver(ref))(rc.hooks)))(function () {
                                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(function (_0) {
                                              var _32 = {};
                                              for (var _33 in _0) {
                                                  if (_0.hasOwnProperty(_33)) {
                                                      _32[_33] = _0[_33];
                                                  };
                                              };
                                              _32.renderPaused = false;
                                              return _32;
                                          })(ref))(function () {
                                              return flushRender(ref);
                                          });
                                      });
                                  });
                              });
                          });
                      };
                      throw new Error("Failed pattern match at Halogen.Driver line 61, column 1 - line 67, column 1: " + [ _30.constructor.name ]);
                  });
              };
              var flushRender = Control_Monad_Rec_Class.tailRecM(Control_Monad_Aff.monadRecAff)(function (ref) {
                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (_9) {
                      return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)(_9))(function () {
                          var _35 = !_9.renderPending;
                          if (_35) {
                              return Prelude.pure(Control_Monad_Aff.applicativeAff)(new Data_Either.Right(Prelude.unit));
                          };
                          if (!_35) {
                              return Prelude.bind(Control_Monad_Aff.bindAff)(render(ref))(function () {
                                  return Prelude.pure(Control_Monad_Aff.applicativeAff)(new Data_Either.Left(ref));
                              });
                          };
                          throw new Error("Failed pattern match at Halogen.Driver line 61, column 1 - line 67, column 1: " + [ _35.constructor.name ]);
                      });
                  });
              });
              var $$eval = function (ref) {
                  return function (h) {
                      if (h instanceof Halogen_Query_HalogenF.StateHF) {
                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.takeVar(ref))(function (_4) {
                              if (h.value0 instanceof Halogen_Query_StateF.Get) {
                                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)(_4))(function () {
                                      return Prelude.pure(Control_Monad_Aff.applicativeAff)(h.value0.value0(_4.state));
                                  });
                              };
                              if (h.value0 instanceof Halogen_Query_StateF.Modify) {
                                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(ref)((function () {
                                      var _40 = {};
                                      for (var _41 in _4) {
                                          if (_4.hasOwnProperty(_41)) {
                                              _40[_41] = _4[_41];
                                          };
                                      };
                                      _40.state = h.value0.value0(_4.state);
                                      _40.renderPending = true;
                                      return _40;
                                  })()))(function () {
                                      return Prelude.pure(Control_Monad_Aff.applicativeAff)(h.value0.value1);
                                  });
                              };
                              throw new Error("Failed pattern match at Halogen.Driver line 61, column 1 - line 67, column 1: " + [ h.value0.constructor.name ]);
                          });
                      };
                      if (h instanceof Halogen_Query_HalogenF.SubscribeHF) {
                          var producer = Halogen_Query_EventSource.runEventSource(h.value0);
                          var consumer = Control_Monad_Rec_Class.forever(Control_Monad_Free_Trans.monadRecFreeT(Control_Coroutine.functorAwait)(Control_Monad_Aff.monadAff))(Control_Bind["=<<"](Control_Monad_Free_Trans.bindFreeT(Control_Coroutine.functorAwait)(Control_Monad_Aff.monadAff))(function (_52) {
                              return Control_Monad_Trans.lift(Control_Monad_Free_Trans.monadTransFreeT(Control_Coroutine.functorAwait))(Control_Monad_Aff.monadAff)(driver(ref)(_52));
                          })(Control_Coroutine.await(Control_Monad_Aff.monadAff)));
                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff.forkAff(Control_Coroutine_Stalling.runStallingProcess(Control_Monad_Aff.monadRecAff)(Control_Coroutine_Stalling["$$?"](Control_Monad_Aff.monadRecAff)(producer)(consumer))))(function () {
                              return Prelude.pure(Control_Monad_Aff.applicativeAff)(h.value1);
                          });
                      };
                      if (h instanceof Halogen_Query_HalogenF.QueryHF) {
                          return Prelude.bind(Control_Monad_Aff.bindAff)(render(ref))(function () {
                              return h.value0;
                          });
                      };
                      if (h instanceof Halogen_Query_HalogenF.HaltHF) {
                          return Control_Plus.empty(Control_Monad_Aff.plusAff);
                      };
                      throw new Error("Failed pattern match at Halogen.Driver line 61, column 1 - line 67, column 1: " + [ h.constructor.name ]);
                  };
              };
              var driver = function (ref) {
                  return function (q) {
                      return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Free.runFreeM(Halogen_Query_HalogenF.functorHalogenF(Control_Monad_Aff.functorAff))(Control_Monad_Aff.monadRecAff)($$eval(ref))(Halogen_Component.queryComponent(c)(q)))(function (_3) {
                          return Prelude.bind(Control_Monad_Aff.bindAff)(render(ref))(function () {
                              return Prelude.pure(Control_Monad_Aff.applicativeAff)(_3);
                          });
                      });
                  };
              };
              return Prelude["<$>"](Control_Monad_Aff.functorAff)(function (_1) {
                  return _1.driver;
              })(Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.makeVar)(function (_10) {
                  var rc = Halogen_Component.renderComponent(c)(s);
                  var dr = driver(_10);
                  var vtree = Halogen_HTML_Renderer_VirtualDOM.renderTree(dr)(rc.tree);
                  var node = Halogen_Internal_VirtualDOM.createElement(vtree);
                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.putVar(_10)({
                      node: node, 
                      vtree: vtree, 
                      state: rc.state, 
                      renderPending: false, 
                      renderPaused: true
                  }))(function () {
                      return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(DOM_Node_Node.appendChild(DOM_HTML_Types.htmlElementToNode(node))(DOM_HTML_Types.htmlElementToNode(element))))(function () {
                          return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff.forkAll(Data_List.foldableList)(onInitializers(Data_Foldable.foldableArray)(dr)(rc.hooks)))(function () {
                              return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff.forkAff(Data_Maybe.maybe(Prelude.pure(Control_Monad_Aff.applicativeAff)(Prelude.unit))(dr)(Halogen_Component.initializeComponent(c))))(function () {
                                  return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_AVar.modifyVar(function (_2) {
                                      var _50 = {};
                                      for (var _51 in _2) {
                                          if (_2.hasOwnProperty(_51)) {
                                              _50[_51] = _2[_51];
                                          };
                                      };
                                      _50.renderPaused = false;
                                      return _50;
                                  })(_10))(function () {
                                      return Prelude.bind(Control_Monad_Aff.bindAff)(flushRender(_10))(function () {
                                          return Prelude.pure(Control_Monad_Aff.applicativeAff)({
                                              driver: dr
                                          });
                                      });
                                  });
                              });
                          });
                      });
                  });
              }));
          };
      };
  };
  exports["runUI"] = runUI;;
 
})(PS["Halogen.Driver"] = PS["Halogen.Driver"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var tr = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("tr"))(xs);
  };
  var tr_ = tr([  ]);
  var td = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("td"))(xs);
  };
  var td_ = td([  ]);
  var tbody = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("tbody"))(xs);
  };
  var tbody_ = tbody([  ]);
  var table = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("table"))(xs);
  };
  var table_ = table([  ]);
  var p = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("p"))(xs);
  };
  var p_ = p([  ]);
  var img = function (props) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("img"))(props)([  ]);
  };                 
  var div = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("div"))(xs);
  };
  var div_ = div([  ]);
  var button = function (xs) {
      return Halogen_HTML_Core.element(Halogen_HTML_Core.tagName("button"))(xs);
  };
  exports["tr_"] = tr_;
  exports["tr"] = tr;
  exports["td_"] = td_;
  exports["td"] = td;
  exports["tbody_"] = tbody_;
  exports["tbody"] = tbody;
  exports["table_"] = table_;
  exports["table"] = table;
  exports["p_"] = p_;
  exports["p"] = p;
  exports["img"] = img;
  exports["div_"] = div_;
  exports["div"] = div;
  exports["button"] = button;;
 
})(PS["Halogen.HTML.Elements"] = PS["Halogen.HTML.Elements"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Component_ChildPath = PS["Halogen.Component.ChildPath"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];     
  var text = Halogen_HTML_Core.Text.create;
  exports["text"] = text;;
 
})(PS["Halogen.HTML"] = PS["Halogen.HTML"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_String = PS["Data.String"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];                                                                                                                        
  var src = Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("src"))(Data_Maybe.Just.create(Halogen_HTML_Core.attrName("src")));                   
  var disabled = Halogen_HTML_Core.prop(Halogen_HTML_Core.booleanIsProp)(Halogen_HTML_Core.propName("disabled"))(Data_Maybe.Just.create(Halogen_HTML_Core.attrName("disabled")));
  var classes = function (_8) {
      return Halogen_HTML_Core.prop(Halogen_HTML_Core.stringIsProp)(Halogen_HTML_Core.propName("className"))(Data_Maybe.Just.create(Halogen_HTML_Core.attrName("class")))(Data_String.joinWith(" ")(Prelude.map(Prelude.functorArray)(Halogen_HTML_Core.runClassName)(_8)));
  };
  exports["disabled"] = disabled;
  exports["src"] = src;
  exports["classes"] = classes;;
 
})(PS["Halogen.HTML.Properties"] = PS["Halogen.HTML.Properties"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Tuple = PS["Data.Tuple"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Properties = PS["Halogen.HTML.Properties"];
  var Data_Monoid = PS["Data.Monoid"];
  var refine = Unsafe_Coerce.unsafeCoerce;                    
  var src = refine(Halogen_HTML_Properties.src);     
  var disabled = refine(Halogen_HTML_Properties.disabled);
  var enabled = function (_21) {
      return disabled(!_21);
  };                                                    
  var classes = refine(Halogen_HTML_Properties.classes);
  exports["enabled"] = enabled;
  exports["disabled"] = disabled;
  exports["src"] = src;
  exports["classes"] = classes;;
 
})(PS["Halogen.HTML.Properties.Indexed"] = PS["Halogen.HTML.Properties.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];                                  
  var td = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements.td);      
  var img = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements.img);      
  var button = Unsafe_Coerce.unsafeCoerce(Halogen_HTML_Elements.button);
  exports["td"] = td;
  exports["img"] = img;
  exports["button"] = button;;
 
})(PS["Halogen.HTML.Elements.Indexed"] = PS["Halogen.HTML.Elements.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];                                          
  var onClick = Halogen_HTML_Core.handler(Halogen_HTML_Core.eventName("click"));
  var input_ = function (f) {
      return function (_0) {
          return Prelude.pure(Halogen_HTML_Events_Handler.applicativeEventHandler)(Halogen_Query.action(f));
      };
  };
  exports["onClick"] = onClick;
  exports["input_"] = input_;;
 
})(PS["Halogen.HTML.Events"] = PS["Halogen.HTML.Events"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Unsafe_Coerce = PS["Unsafe.Coerce"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Events = PS["Halogen.HTML.Events"];
  var Halogen_HTML_Events_Forms = PS["Halogen.HTML.Events.Forms"];
  var Halogen_HTML_Events_Handler = PS["Halogen.HTML.Events.Handler"];
  var Halogen_HTML_Events_Types = PS["Halogen.HTML.Events.Types"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var refine = Unsafe_Coerce.unsafeCoerce;                      
  var onClick = refine(Halogen_HTML_Events.onClick);
  exports["onClick"] = onClick;;
 
})(PS["Halogen.HTML.Events.Indexed"] = PS["Halogen.HTML.Events.Indexed"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Control_Bind = PS["Control.Bind"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Class = PS["Control.Monad.Eff.Class"];
  var Control_Monad_Eff_Exception = PS["Control.Monad.Eff.Exception"];
  var Control_Monad_Error_Class = PS["Control.Monad.Error.Class"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Either = PS["Data.Either"];
  var Data_Nullable = PS["Data.Nullable"];
  var Data_Foreign = PS["Data.Foreign"];
  var DOM = PS["DOM"];
  var DOM_Event_EventTarget = PS["DOM.Event.EventTarget"];
  var DOM_Event_EventTypes = PS["DOM.Event.EventTypes"];
  var DOM_HTML = PS["DOM.HTML"];
  var DOM_HTML_Types = PS["DOM.HTML.Types"];
  var DOM_HTML_Window = PS["DOM.HTML.Window"];
  var DOM_Node_ParentNode = PS["DOM.Node.ParentNode"];
  var Halogen_Effects = PS["Halogen.Effects"];     
  var selectElement = function (query) {
      return Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff)(Prelude["<$>"](Control_Monad_Eff.functorEff)(Data_Nullable.toMaybe)(Control_Bind["=<<"](Control_Monad_Eff.bindEff)(Control_Bind["<=<"](Control_Monad_Eff.bindEff)(function (_8) {
          return DOM_Node_ParentNode.querySelector(query)(DOM_HTML_Types.htmlDocumentToParentNode(_8));
      })(DOM_HTML_Window.document))(DOM_HTML.window))))(function (_0) {
          return Prelude.pure(Control_Monad_Aff.applicativeAff)((function () {
              if (_0 instanceof Data_Maybe.Nothing) {
                  return Data_Maybe.Nothing.value;
              };
              if (_0 instanceof Data_Maybe.Just) {
                  return Data_Either.either(Prelude["const"](Data_Maybe.Nothing.value))(Data_Maybe.Just.create)(DOM_HTML_Types.readHTMLElement(Data_Foreign.toForeign(_0.value0)));
              };
              throw new Error("Failed pattern match at Halogen.Util line 46, column 1 - line 50, column 1: " + [ _0.constructor.name ]);
          })());
      });
  };
  var runHalogenAff = Control_Monad_Aff.runAff(Control_Monad_Eff_Exception.throwException)(Prelude["const"](Prelude.pure(Control_Monad_Eff.applicativeEff)(Prelude.unit)));
  var awaitLoad = Control_Monad_Aff.makeAff(function (_2) {
      return function (callback) {
          return Control_Monad_Eff_Class.liftEff(Control_Monad_Eff_Class.monadEffEff)(Prelude[">>="](Control_Monad_Eff.bindEff)(DOM_HTML.window)(Prelude[">>>"](Prelude.semigroupoidFn)(DOM_HTML_Types.windowToEventTarget)(DOM_Event_EventTarget.addEventListener(DOM_Event_EventTypes.load)(DOM_Event_EventTarget.eventListener(function (_1) {
              return callback(Prelude.unit);
          }))(false))));
      };
  });
  var awaitBody = Prelude.bind(Control_Monad_Aff.bindAff)(awaitLoad)(function () {
      return Control_Bind["=<<"](Control_Monad_Aff.bindAff)(Data_Maybe.maybe(Control_Monad_Error_Class.throwError(Control_Monad_Aff.monadErrorAff)(Control_Monad_Eff_Exception.error("Could not find body")))(Prelude.pure(Control_Monad_Aff.applicativeAff)))(selectElement("body"));
  });
  exports["runHalogenAff"] = runHalogenAff;
  exports["selectElement"] = selectElement;
  exports["awaitBody"] = awaitBody;
  exports["awaitLoad"] = awaitLoad;;
 
})(PS["Halogen.Util"] = PS["Halogen.Util"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Prelude = PS["Prelude"];
  var Data_Array = PS["Data.Array"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Generic = PS["Data.Generic"];
  var Data_Maybe = PS["Data.Maybe"];     
  var Scored = (function () {
      function Scored(value0) {
          this.value0 = value0;
      };
      Scored.create = function (value0) {
          return new Scored(value0);
      };
      return Scored;
  })();
  var Option = (function () {
      function Option(value0) {
          this.value0 = value0;
      };
      Option.create = function (value0) {
          return new Option(value0);
      };
      return Option;
  })();
  var Aces = (function () {
      function Aces() {

      };
      Aces.value = new Aces();
      return Aces;
  })();
  var Twos = (function () {
      function Twos() {

      };
      Twos.value = new Twos();
      return Twos;
  })();
  var Threes = (function () {
      function Threes() {

      };
      Threes.value = new Threes();
      return Threes;
  })();
  var Fours = (function () {
      function Fours() {

      };
      Fours.value = new Fours();
      return Fours;
  })();
  var Fives = (function () {
      function Fives() {

      };
      Fives.value = new Fives();
      return Fives;
  })();
  var Sixes = (function () {
      function Sixes() {

      };
      Sixes.value = new Sixes();
      return Sixes;
  })();
  var ThreeOfAKind = (function () {
      function ThreeOfAKind() {

      };
      ThreeOfAKind.value = new ThreeOfAKind();
      return ThreeOfAKind;
  })();
  var FourOfAKind = (function () {
      function FourOfAKind() {

      };
      FourOfAKind.value = new FourOfAKind();
      return FourOfAKind;
  })();
  var FullHouse = (function () {
      function FullHouse() {

      };
      FullHouse.value = new FullHouse();
      return FullHouse;
  })();
  var SmallStraight = (function () {
      function SmallStraight() {

      };
      SmallStraight.value = new SmallStraight();
      return SmallStraight;
  })();
  var LargeStraight = (function () {
      function LargeStraight() {

      };
      LargeStraight.value = new LargeStraight();
      return LargeStraight;
  })();
  var Yahtzee = (function () {
      function Yahtzee() {

      };
      Yahtzee.value = new Yahtzee();
      return Yahtzee;
  })();
  var Chance = (function () {
      function Chance() {

      };
      Chance.value = new Chance();
      return Chance;
  })();
  var upperSectionCategories = [ Aces.value, Twos.value, Threes.value, Fours.value, Fives.value, Sixes.value ];
  var scoreYahtzee = function (dice) {
      var isYahtzee = Data_Array.length(Data_Array.group(Prelude.eqInt)(dice)) === 1;
      if (isYahtzee) {
          return new Data_Maybe.Just(50);
      };
      if (!isYahtzee) {
          return Data_Maybe.Nothing.value;
      };
      throw new Error("Failed pattern match at Yahtzee line 115, column 1 - line 116, column 1: " + [ isYahtzee.constructor.name ]);
  };
  var scoreStraight = function (n) {
      return function (dice) {
          var straightStartingFrom = function (die) {
              return Data_Array[".."](die)((die + n | 0) - 1);
          };
          var points = function (_8) {
              if (_8 === 4) {
                  return new Data_Maybe.Just(30);
              };
              if (_8 === 5) {
                  return new Data_Maybe.Just(40);
              };
              return Data_Maybe.Nothing.value;
          };
          var isStraight = Data_Foldable.any(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (die) {
              return Data_Foldable.all(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (_3) {
                  return Data_Foldable.elem(Data_Foldable.foldableArray)(Prelude.eqInt)(_3)(dice);
              })(straightStartingFrom(die));
          })(dice);
          if (isStraight) {
              return points(n);
          };
          if (!isStraight) {
              return Data_Maybe.Nothing.value;
          };
          throw new Error("Failed pattern match at Yahtzee line 107, column 1 - line 108, column 1: " + [ isStraight.constructor.name ]);
      };
  };
  var scorePips = function (n) {
      return function (dice) {
          return new Data_Maybe.Just(Data_Foldable.sum(Data_Foldable.foldableArray)(Prelude.semiringInt)(Data_Array.filter(function (_1) {
              return _1 === n;
          })(dice)));
      };
  };
  var scoreKinds = function (n) {
      return function (dice) {
          var isOfAKind = Prelude[">>>"](Prelude.semigroupoidFn)(Data_Array["group'"](Prelude.ordInt))(Prelude[">>>"](Prelude.semigroupoidFn)(Prelude.map(Prelude.functorArray)(Data_Array.length))(Data_Foldable.any(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (_2) {
              return _2 >= n;
          })));
          var _12 = isOfAKind(dice);
          if (_12) {
              return new Data_Maybe.Just(Data_Foldable.sum(Data_Foldable.foldableArray)(Prelude.semiringInt)(dice));
          };
          if (!_12) {
              return Data_Maybe.Nothing.value;
          };
          throw new Error("Failed pattern match at Yahtzee line 98, column 1 - line 99, column 1: " + [ _12.constructor.name ]);
      };
  };
  var scoreFullHouse = function (dice) {
      var groupDice = Prelude[">>>"](Prelude.semigroupoidFn)(Data_Array["group'"](Prelude.ordInt))(Prelude[">>>"](Prelude.semigroupoidFn)(Prelude.map(Prelude.functorArray)(Data_Array.length))(Data_Array.sort(Prelude.ordInt)));
      var isFullHouse = function (dice_1) {
          return Prelude["=="](Prelude.eqArray(Prelude.eqInt))(groupDice(dice_1))([ 2, 3 ]);
      };
      var _13 = isFullHouse(dice);
      if (_13) {
          return new Data_Maybe.Just(25);
      };
      if (!_13) {
          return Data_Maybe.Nothing.value;
      };
      throw new Error("Failed pattern match at Yahtzee line 102, column 1 - line 103, column 1: " + [ _13.constructor.name ]);
  };
  var score = function (_4) {
      if (_4 instanceof Aces) {
          return scorePips(1);
      };
      if (_4 instanceof Twos) {
          return scorePips(2);
      };
      if (_4 instanceof Threes) {
          return scorePips(3);
      };
      if (_4 instanceof Fours) {
          return scorePips(4);
      };
      if (_4 instanceof Fives) {
          return scorePips(5);
      };
      if (_4 instanceof Sixes) {
          return scorePips(6);
      };
      if (_4 instanceof ThreeOfAKind) {
          return scoreKinds(3);
      };
      if (_4 instanceof FourOfAKind) {
          return scoreKinds(4);
      };
      if (_4 instanceof FullHouse) {
          return scoreFullHouse;
      };
      if (_4 instanceof SmallStraight) {
          return scoreStraight(4);
      };
      if (_4 instanceof LargeStraight) {
          return scoreStraight(5);
      };
      if (_4 instanceof Yahtzee) {
          return scoreYahtzee;
      };
      if (_4 instanceof Chance) {
          return function (_56) {
              return Data_Maybe.Just.create(Data_Foldable.sum(Data_Foldable.foldableArray)(Prelude.semiringInt)(_56));
          };
      };
      throw new Error("Failed pattern match at Yahtzee line 79, column 1 - line 80, column 1: " + [ _4.constructor.name ]);
  };
  var maxRerolls = 2;
  var lowerSectionCategories = [ ThreeOfAKind.value, FourOfAKind.value, FullHouse.value, SmallStraight.value, LargeStraight.value, Yahtzee.value, Chance.value ];
  var genericCategory = new Data_Generic.Generic(function ($dollarx) {
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Aces" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Aces.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Twos" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Twos.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Threes" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Threes.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Fours" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Fours.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Fives" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Fives.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Sixes" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Sixes.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.ThreeOfAKind" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(ThreeOfAKind.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.FourOfAKind" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(FourOfAKind.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.FullHouse" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(FullHouse.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.SmallStraight" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(SmallStraight.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.LargeStraight" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(LargeStraight.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Yahtzee" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Yahtzee.value);
      };
      if ($dollarx instanceof Data_Generic.SProd && ($dollarx.value0 === "Yahtzee.Chance" && $dollarx.value1.length === 0)) {
          return new Data_Maybe.Just(Chance.value);
      };
      return Data_Maybe.Nothing.value;
  }, function ($dollarq) {
      return new Data_Generic.SigProd("Yahtzee.Category", [ {
          sigConstructor: "Yahtzee.Aces", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Twos", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Threes", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Fours", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Fives", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Sixes", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.ThreeOfAKind", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.FourOfAKind", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.FullHouse", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.SmallStraight", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.LargeStraight", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Yahtzee", 
          sigValues: [  ]
      }, {
          sigConstructor: "Yahtzee.Chance", 
          sigValues: [  ]
      } ]);
  }, function ($dollarx) {
      if ($dollarx instanceof Aces) {
          return new Data_Generic.SProd("Yahtzee.Aces", [  ]);
      };
      if ($dollarx instanceof Twos) {
          return new Data_Generic.SProd("Yahtzee.Twos", [  ]);
      };
      if ($dollarx instanceof Threes) {
          return new Data_Generic.SProd("Yahtzee.Threes", [  ]);
      };
      if ($dollarx instanceof Fours) {
          return new Data_Generic.SProd("Yahtzee.Fours", [  ]);
      };
      if ($dollarx instanceof Fives) {
          return new Data_Generic.SProd("Yahtzee.Fives", [  ]);
      };
      if ($dollarx instanceof Sixes) {
          return new Data_Generic.SProd("Yahtzee.Sixes", [  ]);
      };
      if ($dollarx instanceof ThreeOfAKind) {
          return new Data_Generic.SProd("Yahtzee.ThreeOfAKind", [  ]);
      };
      if ($dollarx instanceof FourOfAKind) {
          return new Data_Generic.SProd("Yahtzee.FourOfAKind", [  ]);
      };
      if ($dollarx instanceof FullHouse) {
          return new Data_Generic.SProd("Yahtzee.FullHouse", [  ]);
      };
      if ($dollarx instanceof SmallStraight) {
          return new Data_Generic.SProd("Yahtzee.SmallStraight", [  ]);
      };
      if ($dollarx instanceof LargeStraight) {
          return new Data_Generic.SProd("Yahtzee.LargeStraight", [  ]);
      };
      if ($dollarx instanceof Yahtzee) {
          return new Data_Generic.SProd("Yahtzee.Yahtzee", [  ]);
      };
      if ($dollarx instanceof Chance) {
          return new Data_Generic.SProd("Yahtzee.Chance", [  ]);
      };
      throw new Error("Failed pattern match at Yahtzee line 24, column 1 - line 25, column 1: " + [ $dollarx.constructor.name ]);
  });                                                                      
  var eqCategory = new Prelude.Eq(Data_Generic.gEq(genericCategory));
  var recalculate = function (scores) {
      return function (dice) {
          var summableScore = function (_7) {
              if (_7 instanceof Scored && _7.value0 instanceof Data_Maybe.Just) {
                  return _7.value0.value0;
              };
              return 0;
          };
          var sumSection = function (scores_1) {
              return Data_Foldable.sum(Data_Foldable.foldableArray)(Prelude.semiringInt)(Prelude.map(Prelude.functorArray)(function (sf) {
                  return summableScore(sf.state);
              })(scores_1));
          };
          var newScore = function (category) {
              return function (_5) {
                  if (_5 instanceof Scored) {
                      return new Scored(_5.value0);
                  };
                  if (_5 instanceof Option) {
                      return new Option(score(category)(dice));
                  };
                  throw new Error("Failed pattern match at Yahtzee line 50, column 1 - line 51, column 1: " + [ category.constructor.name, _5.constructor.name ]);
              };
          };
          var newScores = Prelude.map(Prelude.functorArray)(function (sf) {
              var _50 = {};
              for (var _51 in sf) {
                  if (sf.hasOwnProperty(_51)) {
                      _50[_51] = sf[_51];
                  };
              };
              _50.state = newScore(sf.category)(sf.state);
              return _50;
          })(scores);
          var isScored = function (_6) {
              if (_6 instanceof Scored) {
                  return true;
              };
              if (_6 instanceof Option) {
                  return false;
              };
              throw new Error("Failed pattern match at Yahtzee line 50, column 1 - line 51, column 1: " + [ _6.constructor.name ]);
          };
          var gameOver = Data_Foldable.all(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (sf) {
              return isScored(sf.state);
          })(scores);
          var filterForCategories = function (categories) {
              return Data_Array.filter(function (sf) {
                  return Data_Foldable.any(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (_0) {
                      return Prelude["=="](eqCategory)(_0)(sf.category);
                  })(categories);
              });
          };
          var lowerSectionScores = filterForCategories(lowerSectionCategories)(scores);
          var sumLowerSection = sumSection(lowerSectionScores);
          var upperSectionScores = filterForCategories(upperSectionCategories)(scores);
          var sumUpperSection = sumSection(upperSectionScores);
          var bonusUpperSection = (function () {
              var _55 = sumUpperSection >= 63;
              if (_55) {
                  return 35;
              };
              if (!_55) {
                  return 0;
              };
              throw new Error("Failed pattern match at Yahtzee line 50, column 1 - line 51, column 1: " + [ _55.constructor.name ]);
          })();
          var finalUpperSection = sumUpperSection + bonusUpperSection | 0;
          var finalSum = finalUpperSection + sumLowerSection | 0;
          return {
              scores: newScores, 
              sumUpperSection: sumUpperSection, 
              bonusUpperSection: bonusUpperSection, 
              finalUpperSection: finalUpperSection, 
              sumLowerSection: sumLowerSection, 
              finalSum: finalSum, 
              gameOver: gameOver
          };
      };
  };
  exports["Scored"] = Scored;
  exports["Option"] = Option;
  exports["Aces"] = Aces;
  exports["Twos"] = Twos;
  exports["Threes"] = Threes;
  exports["Fours"] = Fours;
  exports["Fives"] = Fives;
  exports["Sixes"] = Sixes;
  exports["ThreeOfAKind"] = ThreeOfAKind;
  exports["FourOfAKind"] = FourOfAKind;
  exports["FullHouse"] = FullHouse;
  exports["SmallStraight"] = SmallStraight;
  exports["LargeStraight"] = LargeStraight;
  exports["Yahtzee"] = Yahtzee;
  exports["Chance"] = Chance;
  exports["scoreYahtzee"] = scoreYahtzee;
  exports["scoreStraight"] = scoreStraight;
  exports["scoreFullHouse"] = scoreFullHouse;
  exports["scoreKinds"] = scoreKinds;
  exports["scorePips"] = scorePips;
  exports["score"] = score;
  exports["recalculate"] = recalculate;
  exports["maxRerolls"] = maxRerolls;
  exports["lowerSectionCategories"] = lowerSectionCategories;
  exports["upperSectionCategories"] = upperSectionCategories;
  exports["genericCategory"] = genericCategory;
  exports["eqCategory"] = eqCategory;;
 
})(PS["Yahtzee"] = PS["Yahtzee"] || {});
(function(exports) {
  // Generated by psc version 0.7.6.1
  "use strict";
  var Halogen_HTML_Events = PS["Halogen.HTML.Events"];
  var Halogen_HTML_Elements_Indexed = PS["Halogen.HTML.Elements.Indexed"];
  var Halogen_HTML_Elements = PS["Halogen.HTML.Elements"];
  var Halogen_HTML = PS["Halogen.HTML"];
  var Halogen_Query = PS["Halogen.Query"];
  var Halogen_Component = PS["Halogen.Component"];
  var Halogen_Driver = PS["Halogen.Driver"];
  var Prelude = PS["Prelude"];
  var Control_Monad_Aff = PS["Control.Monad.Aff"];
  var Control_Monad_Aff_Free = PS["Control.Monad.Aff.Free"];
  var Control_Monad_Eff = PS["Control.Monad.Eff"];
  var Control_Monad_Eff_Random = PS["Control.Monad.Eff.Random"];
  var Data_Array = PS["Data.Array"];
  var Data_Foldable = PS["Data.Foldable"];
  var Data_Maybe = PS["Data.Maybe"];
  var Data_Traversable = PS["Data.Traversable"];
  var Data_Tuple = PS["Data.Tuple"];
  var Halogen = PS["Halogen"];
  var Halogen_Util = PS["Halogen.Util"];
  var Halogen_HTML_Core = PS["Halogen.HTML.Core"];
  var Halogen_HTML_Indexed = PS["Halogen.HTML.Indexed"];
  var Halogen_HTML_Events_Indexed = PS["Halogen.HTML.Events.Indexed"];
  var Halogen_HTML_Properties_Indexed = PS["Halogen.HTML.Properties.Indexed"];
  var Yahtzee = PS["Yahtzee"];
  var Control_Monad_Free = PS["Control.Monad.Free"];
  var Halogen_Query_HalogenF = PS["Halogen.Query.HalogenF"];     
  var Score = (function () {
      function Score(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      Score.create = function (value0) {
          return function (value1) {
              return new Score(value0, value1);
          };
      };
      return Score;
  })();
  var Roll = (function () {
      function Roll(value0) {
          this.value0 = value0;
      };
      Roll.create = function (value0) {
          return new Roll(value0);
      };
      return Roll;
  })();
  var MarkDie = (function () {
      function MarkDie(value0, value1) {
          this.value0 = value0;
          this.value1 = value1;
      };
      MarkDie.create = function (value0) {
          return function (value1) {
              return new MarkDie(value0, value1);
          };
      };
      return MarkDie;
  })();
  var Restart = (function () {
      function Restart(value0) {
          this.value0 = value0;
      };
      Restart.create = function (value0) {
          return new Restart(value0);
      };
      return Restart;
  })();
  var zipWithIndex = function (array) {
      return Data_Array.zip(array)(Data_Array.range(0)(Data_Array.length(array)));
  };
  var randomPips5 = Data_Traversable.sequence(Data_Traversable.traversableArray)(Control_Monad_Eff.applicativeEff)(Data_Array.replicate(5)(Control_Monad_Eff_Random.randomInt(1)(6)));
  var pipsToDice = Prelude.map(Prelude.functorArray)(function (d) {
      return {
          marked: false, 
          value: d
      };
  });
  var makeInitialState = function (ds) {
      var categories = Prelude["++"](Prelude.semigroupArray)(Yahtzee.upperSectionCategories)(Yahtzee.lowerSectionCategories);
      var calculation = Yahtzee.recalculate(Prelude.map(Prelude.functorArray)(function (c) {
          return {
              category: c, 
              state: new Yahtzee.Option(Data_Maybe.Nothing.value)
          };
      })(categories))(ds);
      return {
          dice: pipsToDice(ds), 
          rerolls: 0, 
          game: calculation
      };
  };
  var ui = (function () {
      var render = function (state) {
          var rerollsPossible = Yahtzee.maxRerolls - state.rerolls;
          var rerollsAllowed = state.rerolls < Yahtzee.maxRerolls;
          var renderScoreRow = function (sf) {
              var showJust = function (maybe) {
                  return Data_Maybe.fromMaybe("-")(Prelude.map(Data_Maybe.functorMaybe)(Prelude.show(Prelude.showInt))(maybe));
              };
              var showCategory = function (_9) {
                  if (_9 instanceof Yahtzee.Aces) {
                      return "Einser";
                  };
                  if (_9 instanceof Yahtzee.Twos) {
                      return "Zweier";
                  };
                  if (_9 instanceof Yahtzee.Threes) {
                      return "Dreier";
                  };
                  if (_9 instanceof Yahtzee.Fours) {
                      return "Vierer";
                  };
                  if (_9 instanceof Yahtzee.Fives) {
                      return "F\xfcnfer";
                  };
                  if (_9 instanceof Yahtzee.Sixes) {
                      return "Sechser";
                  };
                  if (_9 instanceof Yahtzee.ThreeOfAKind) {
                      return "Dreierpasch";
                  };
                  if (_9 instanceof Yahtzee.FourOfAKind) {
                      return "Viererpasch";
                  };
                  if (_9 instanceof Yahtzee.FullHouse) {
                      return "Full House";
                  };
                  if (_9 instanceof Yahtzee.SmallStraight) {
                      return "Kleine Stra\xdfe";
                  };
                  if (_9 instanceof Yahtzee.LargeStraight) {
                      return "Gro\xdfe Stra\xdfe";
                  };
                  if (_9 instanceof Yahtzee.Yahtzee) {
                      return "Yahtzee!";
                  };
                  if (_9 instanceof Yahtzee.Chance) {
                      return "Chance";
                  };
                  throw new Error("Failed pattern match at Main line 111, column 3 - line 112, column 3: " + [ _9.constructor.name ]);
              };
              var onclick = Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_(Score.create(sf.category)));
              return Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text(showCategory(sf.category)) ]), (function () {
                  if (sf.state instanceof Yahtzee.Scored) {
                      return Halogen_HTML_Elements_Indexed.td([ Halogen_HTML_Properties_Indexed.classes([ Halogen_HTML_Core.className("scored") ]) ])([ Halogen_HTML.text(showJust(sf.state.value0)) ]);
                  };
                  if (sf.state instanceof Yahtzee.Option && sf.state.value0 instanceof Data_Maybe.Just) {
                      return Halogen_HTML_Elements_Indexed.td([ onclick, Halogen_HTML_Properties_Indexed.classes([ Halogen_HTML_Core.className("option") ]) ])([ Halogen_HTML.text(Prelude.show(Prelude.showInt)(sf.state.value0.value0)) ]);
                  };
                  if (sf.state instanceof Yahtzee.Option && sf.state.value0 instanceof Data_Maybe.Nothing) {
                      return Halogen_HTML_Elements_Indexed.td([ onclick, Halogen_HTML_Properties_Indexed.classes([ Halogen_HTML_Core.className("discard") ]) ])([ Halogen_HTML.text("-") ]);
                  };
                  throw new Error("Failed pattern match at Main line 111, column 3 - line 112, column 3: " + [ sf.state.constructor.name ]);
              })() ]);
          };
          var renderDieWithIndex = function (_8) {
              var onclick = Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_(MarkDie.create(_8.value1)));
              var classes = Halogen_HTML_Properties_Indexed.classes(Prelude["++"](Prelude.semigroupArray)([ Halogen_HTML_Core.className("die") ])((function () {
                  if (_8.value0.marked) {
                      return [ Halogen_HTML_Core.className("marked") ];
                  };
                  if (!_8.value0.marked) {
                      return [  ];
                  };
                  throw new Error("Failed pattern match at Main line 111, column 3 - line 112, column 3: " + [ _8.value0.marked.constructor.name ]);
              })()));
              return Halogen_HTML_Elements_Indexed.img([ classes, onclick, Halogen_HTML_Properties_Indexed.src("Dice-" + (Prelude.show(Prelude.showInt)(_8.value0.value) + ".svg")) ]);
          };
          var filterForCategories = function (categories) {
              return Data_Array.filter(function (sf) {
                  return Data_Foldable.any(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (_1) {
                      return Prelude["=="](Yahtzee.eqCategory)(_1)(sf.category);
                  })(categories);
              });
          };
          var lowerSectionScores = filterForCategories(Yahtzee.lowerSectionCategories)(state.game.scores);
          var upperSectionScores = filterForCategories(Yahtzee.upperSectionCategories)(state.game.scores);
          var anyDieMarked = Data_Foldable.any(Data_Foldable.foldableArray)(Prelude.booleanAlgebraBoolean)(function (d) {
              return d.marked;
          })(state.dice);
          return Halogen_HTML_Elements.div_([ Halogen_HTML_Elements.div_(Prelude.map(Prelude.functorArray)(renderDieWithIndex)(zipWithIndex(state.dice))), Halogen_HTML_Elements_Indexed.button([ Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_(Roll.create)), Halogen_HTML_Properties_Indexed.enabled(rerollsAllowed && anyDieMarked) ])([ Halogen_HTML.text("Markierte W\xfcrfel nochmal werfen") ]), Halogen_HTML_Elements.p_([ Halogen_HTML.text((function () {
              if (rerollsAllowed) {
                  return "Noch " + (Prelude.show(Prelude.showInt)(rerollsPossible) + (" Wiederholungs" + ((function () {
                      var _22 = rerollsPossible === 1;
                      if (_22) {
                          return "wurf";
                      };
                      if (!_22) {
                          return "w\xfcrfe";
                      };
                      throw new Error("Failed pattern match: " + [ _22.constructor.name ]);
                  })() + " m\xf6glich")));
              };
              if (!rerollsAllowed) {
                  return "Alle W\xfcrfe sind aufgebraucht - eine Kategorie werten oder streichen!";
              };
              throw new Error("Failed pattern match at Main line 111, column 3 - line 112, column 3: " + [ rerollsAllowed.constructor.name ]);
          })()) ]), Halogen_HTML_Elements.table_([ Halogen_HTML_Elements.tbody_(Prelude["++"](Prelude.semigroupArray)(Prelude.map(Prelude.functorArray)(renderScoreRow)(upperSectionScores))(Prelude["++"](Prelude.semigroupArray)([ Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text("Zwischensumme") ]), Halogen_HTML_Elements.td_([ Halogen_HTML.text(Prelude.show(Prelude.showInt)(state.game.sumUpperSection)) ]) ]) ])(Prelude["++"](Prelude.semigroupArray)([ Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text("Bonus") ]), Halogen_HTML_Elements.td_([ Halogen_HTML.text(Prelude.show(Prelude.showInt)(state.game.bonusUpperSection)) ]) ]) ])(Prelude["++"](Prelude.semigroupArray)([ Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text("Zwischensumme oberer Teil") ]), Halogen_HTML_Elements.td_([ Halogen_HTML.text(Prelude.show(Prelude.showInt)(state.game.finalUpperSection)) ]) ]) ])(Prelude["++"](Prelude.semigroupArray)(Prelude.map(Prelude.functorArray)(renderScoreRow)(lowerSectionScores))(Prelude["++"](Prelude.semigroupArray)([ Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text("Zwischensumme unterer Teil") ]), Halogen_HTML_Elements.td_([ Halogen_HTML.text(Prelude.show(Prelude.showInt)(state.game.sumLowerSection)) ]) ]) ])([ Halogen_HTML_Elements.tr_([ Halogen_HTML_Elements.td_([ Halogen_HTML.text("Endsumme") ]), Halogen_HTML_Elements.td_([ Halogen_HTML.text(Prelude.show(Prelude.showInt)(state.game.finalSum)) ]) ]) ]))))))) ]), Halogen_HTML_Elements.p_((function () {
              if (state.game.gameOver) {
                  return [ Halogen_HTML_Elements_Indexed.button([ Halogen_HTML_Events_Indexed.onClick(Halogen_HTML_Events.input_(Restart.create)) ])([ Halogen_HTML.text("Neues Spiel") ]) ];
              };
              if (!state.game.gameOver) {
                  return [  ];
              };
              throw new Error("Failed pattern match at Main line 111, column 3 - line 112, column 3: " + [ state.game.gameOver.constructor.name ]);
          })()) ]);
      };
      var $$eval = function (_7) {
          if (_7 instanceof Roll) {
              var merge = function (_10) {
                  if (_10.value0.marked) {
                      return {
                          marked: false, 
                          value: _10.value1
                      };
                  };
                  if (!_10.value0.marked) {
                      return _10.value0;
                  };
                  throw new Error("Failed pattern match at Main line 116, column 13 - line 117, column 13: " + [ _10.value0.marked.constructor.name ]);
              };
              var rerollMarkedDice = function (oldDice) {
                  return function (ds) {
                      return Prelude.map(Prelude.functorArray)(merge)(Data_Array.zip(oldDice)(ds));
                  };
              };
              return Prelude.bind(Control_Monad_Free.freeBind)(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff)))(randomPips5))(function (_2) {
                  return Prelude.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                      var _30 = {};
                      for (var _31 in state) {
                          if (state.hasOwnProperty(_31)) {
                              _30[_31] = state[_31];
                          };
                      };
                      _30.dice = rerollMarkedDice(state.dice)(_2);
                      _30.rerolls = state.rerolls + 1 | 0;
                      return _30;
                  }))(function () {
                      return Prelude.pure(Control_Monad_Free.freeApplicative)(_7.value0);
                  });
              });
          };
          if (_7 instanceof MarkDie) {
              var toggleDie = function (i_1) {
                  return function (dice) {
                      return Data_Maybe.fromMaybe(dice)(Data_Array.alterAt(i_1)(function (die) {
                          return new Data_Maybe.Just((function () {
                              var _33 = {};
                              for (var _34 in die) {
                                  if (die.hasOwnProperty(_34)) {
                                      _33[_34] = die[_34];
                                  };
                              };
                              _33.marked = !die.marked;
                              return _33;
                          })());
                      })(dice));
                  };
              };
              return Prelude.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                  var _36 = {};
                  for (var _37 in state) {
                      if (state.hasOwnProperty(_37)) {
                          _36[_37] = state[_37];
                      };
                  };
                  _36.dice = (function () {
                      var _35 = state.rerolls < Yahtzee.maxRerolls;
                      if (_35) {
                          return toggleDie(_7.value0)(state.dice);
                      };
                      if (!_35) {
                          return state.dice;
                      };
                      throw new Error("Failed pattern match at Main line 37, column 1 - line 38, column 1: " + [ _35.constructor.name ]);
                  })();
                  return _36;
              }))(function () {
                  return Prelude.pure(Control_Monad_Free.freeApplicative)(_7.value1);
              });
          };
          if (_7 instanceof Score) {
              var updateScores = function (ds) {
                  return function (state) {
                      var setScore = function (sf) {
                          var _40 = Prelude["=="](Yahtzee.eqCategory)(sf.category)(_7.value0);
                          if (_40) {
                              return {
                                  category: _7.value0, 
                                  state: Yahtzee.Scored.create(Yahtzee.score(_7.value0)(Prelude.map(Prelude.functorArray)(function (_0) {
                                      return _0.value;
                                  })(state.dice)))
                              };
                          };
                          if (!_40) {
                              return sf;
                          };
                          throw new Error("Failed pattern match at Main line 133, column 15 - line 134, column 15: " + [ _40.constructor.name ]);
                      };
                      var newScores = Prelude.map(Prelude.functorArray)(setScore)(state.game.scores);
                      var calculation = Yahtzee.recalculate(newScores)(ds);
                      return {
                          dice: pipsToDice(ds), 
                          rerolls: 0, 
                          game: calculation
                      };
                  };
              };
              return Prelude.bind(Control_Monad_Free.freeBind)(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff)))(randomPips5))(function (_3) {
                  return Prelude.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(updateScores(_3)))(function () {
                      return Prelude.pure(Control_Monad_Free.freeApplicative)(_7.value1);
                  });
              });
          };
          if (_7 instanceof Restart) {
              return Prelude.bind(Control_Monad_Free.freeBind)(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableFree(Halogen_Query_HalogenF.affableHalogenF(Control_Monad_Aff_Free.affableAff)))(randomPips5))(function (_4) {
                  return Prelude.bind(Control_Monad_Free.freeBind)(Halogen_Query.modify(function (state) {
                      return makeInitialState(_4);
                  }))(function () {
                      return Prelude.pure(Control_Monad_Free.freeApplicative)(_7.value0);
                  });
              });
          };
          throw new Error("Failed pattern match at Main line 37, column 1 - line 38, column 1: " + [ _7.constructor.name ]);
      };
      return Halogen_Component.component({
          render: render, 
          "eval": $$eval
      });
  })();
  var main = Halogen_Util.runHalogenAff(Prelude.bind(Control_Monad_Aff.bindAff)(Control_Monad_Aff_Free.fromEff(Control_Monad_Aff_Free.affableAff)(randomPips5))(function (_6) {
      var initialState = makeInitialState(_6);
      return Prelude.bind(Control_Monad_Aff.bindAff)(Halogen_Util.awaitBody)(function (_5) {
          return Halogen_Driver.runUI(ui)(initialState)(_5);
      });
  }));
  exports["Score"] = Score;
  exports["Roll"] = Roll;
  exports["MarkDie"] = MarkDie;
  exports["Restart"] = Restart;
  exports["main"] = main;
  exports["makeInitialState"] = makeInitialState;
  exports["pipsToDice"] = pipsToDice;
  exports["randomPips5"] = randomPips5;
  exports["zipWithIndex"] = zipWithIndex;
  exports["ui"] = ui;;
 
})(PS["Main"] = PS["Main"] || {});

PS["Main"].main();

},{"virtual-dom/create-element":4,"virtual-dom/diff":5,"virtual-dom/patch":6,"virtual-dom/virtual-hyperscript/hooks/soft-set-hook":13,"virtual-dom/vnode/vnode":21,"virtual-dom/vnode/vtext":23}]},{},[27]);
