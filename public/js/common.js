var _self =
  typeof window !== "undefined"
    ? window
    : typeof WorkerGlobalScope !== "undefined" &&
      self instanceof WorkerGlobalScope
    ? self
    : {};
var Prism = (function(_self) {
  var lang = /\blang(?:uage)?-([\w-]+)\b/i;
  var uniqueId = 0;
  var _ = {
    manual: _self.Prism && _self.Prism.manual,
    disableWorkerMessageHandler:
      _self.Prism && _self.Prism.disableWorkerMessageHandler,
    util: {
      encode: function(tokens) {
        if (tokens instanceof Token) {
          return new Token(
            tokens.type,
            _.util.encode(tokens.content),
            tokens.alias
          );
        } else if (Array.isArray(tokens)) {
          return tokens.map(_.util.encode);
        } else {
          return tokens
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/\u00a0/g, " ");
        }
      },
      type: function(o) {
        return Object.prototype.toString.call(o).slice(8, -1);
      },
      objId: function(obj) {
        if (!obj.__id) {
          Object.defineProperty(obj, "__id", { value: ++uniqueId });
        }
        return obj.__id;
      },
      clone: function deepClone(o, visited) {
        var clone,
          id,
          type = _.util.type(o);
        visited = visited || {};
        switch (type) {
          case "Object":
            id = _.util.objId(o);
            if (visited[id]) {
              return visited[id];
            }
            clone = {};
            visited[id] = clone;
            for (var key in o) {
              if (o.hasOwnProperty(key)) {
                clone[key] = deepClone(o[key], visited);
              }
            }
            return clone;
          case "Array":
            id = _.util.objId(o);
            if (visited[id]) {
              return visited[id];
            }
            clone = [];
            visited[id] = clone;
            o.forEach(function(v, i) {
              clone[i] = deepClone(v, visited);
            });
            return clone;
          default:
            return o;
        }
      },
    },
    languages: {
      extend: function(id, redef) {
        var lang = _.util.clone(_.languages[id]);
        for (var key in redef) {
          lang[key] = redef[key];
        }
        return lang;
      },
      insertBefore: function(inside, before, insert, root) {
        root = root || _.languages;
        var grammar = root[inside];
        var ret = {};
        for (var token in grammar) {
          if (grammar.hasOwnProperty(token)) {
            if (token == before) {
              for (var newToken in insert) {
                if (insert.hasOwnProperty(newToken)) {
                  ret[newToken] = insert[newToken];
                }
              }
            }
            if (!insert.hasOwnProperty(token)) {
              ret[token] = grammar[token];
            }
          }
        }
        var old = root[inside];
        root[inside] = ret;
        _.languages.DFS(_.languages, function(key, value) {
          if (value === old && key != inside) {
            this[key] = ret;
          }
        });
        return ret;
      },
      DFS: function DFS(o, callback, type, visited) {
        visited = visited || {};
        var objId = _.util.objId;
        for (var i in o) {
          if (o.hasOwnProperty(i)) {
            callback.call(o, i, o[i], type || i);
            var property = o[i],
              propertyType = _.util.type(property);
            if (propertyType === "Object" && !visited[objId(property)]) {
              visited[objId(property)] = !0;
              DFS(property, callback, null, visited);
            } else if (propertyType === "Array" && !visited[objId(property)]) {
              visited[objId(property)] = !0;
              DFS(property, callback, i, visited);
            }
          }
        }
      },
    },
    plugins: {},
    highlightAll: function(async, callback) {
      _.highlightAllUnder(document, async, callback);
    },
    highlightAllUnder: function(container, async, callback) {
      var env = {
        callback: callback,
        selector:
          'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code',
      };
      _.hooks.run("before-highlightall", env);
      var elements = env.elements || container.querySelectorAll(env.selector);
      for (var i = 0, element; (element = elements[i++]); ) {
        _.highlightElement(element, async === !0, env.callback);
      }
    },
    highlightElement: function(element, async, callback) {
      var language,
        grammar,
        parent = element;
      while (parent && !lang.test(parent.className)) {
        parent = parent.parentNode;
      }
      if (parent) {
        language = (parent.className.match(lang) || [, ""])[1].toLowerCase();
        grammar = _.languages[language];
      }
      element.className =
        element.className.replace(lang, "").replace(/\s+/g, " ") +
        " language-" +
        language;
      if (element.parentNode) {
        parent = element.parentNode;
        if (/pre/i.test(parent.nodeName)) {
          parent.className =
            parent.className.replace(lang, "").replace(/\s+/g, " ") +
            " language-" +
            language;
        }
      }
      var code = element.textContent;
      var env = {
        element: element,
        language: language,
        grammar: grammar,
        code: code,
      };
      var insertHighlightedCode = function(highlightedCode) {
        env.highlightedCode = highlightedCode;
        _.hooks.run("before-insert", env);
        env.element.innerHTML = env.highlightedCode;
        _.hooks.run("after-highlight", env);
        _.hooks.run("complete", env);
        callback && callback.call(env.element);
      };
      _.hooks.run("before-sanity-check", env);
      if (!env.code) {
        _.hooks.run("complete", env);
        return;
      }
      _.hooks.run("before-highlight", env);
      if (!env.grammar) {
        insertHighlightedCode(_.util.encode(env.code));
        return;
      }
      if (async && _self.Worker) {
        var worker = new Worker(_.filename);
        worker.onmessage = function(evt) {
          insertHighlightedCode(evt.data);
        };
        worker.postMessage(
          JSON.stringify({
            language: env.language,
            code: env.code,
            immediateClose: !0,
          })
        );
      } else {
        insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
      }
    },
    highlight: function(text, grammar, language) {
      var env = { code: text, grammar: grammar, language: language };
      _.hooks.run("before-tokenize", env);
      env.tokens = _.tokenize(env.code, env.grammar);
      _.hooks.run("after-tokenize", env);
      return Token.stringify(_.util.encode(env.tokens), env.language);
    },
    matchGrammar: function(
      text,
      strarr,
      grammar,
      index,
      startPos,
      oneshot,
      target
    ) {
      for (var token in grammar) {
        if (!grammar.hasOwnProperty(token) || !grammar[token]) {
          continue;
        }
        if (token == target) {
          return;
        }
        var patterns = grammar[token];
        patterns = _.util.type(patterns) === "Array" ? patterns : [patterns];
        for (var j = 0; j < patterns.length; ++j) {
          var pattern = patterns[j],
            inside = pattern.inside,
            lookbehind = !!pattern.lookbehind,
            greedy = !!pattern.greedy,
            lookbehindLength = 0,
            alias = pattern.alias;
          if (greedy && !pattern.pattern.global) {
            var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
            pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
          }
          pattern = pattern.pattern || pattern;
          for (
            var i = index, pos = startPos;
            i < strarr.length;
            pos += strarr[i].length, ++i
          ) {
            var str = strarr[i];
            if (strarr.length > text.length) {
              return;
            }
            if (str instanceof Token) {
              continue;
            }
            if (greedy && i != strarr.length - 1) {
              pattern.lastIndex = pos;
              var match = pattern.exec(text);
              if (!match) {
                break;
              }
              var from = match.index + (lookbehind ? match[1].length : 0),
                to = match.index + match[0].length,
                k = i,
                p = pos;
              for (
                var len = strarr.length;
                k < len &&
                (p < to || (!strarr[k].type && !strarr[k - 1].greedy));
                ++k
              ) {
                p += strarr[k].length;
                if (from >= p) {
                  ++i;
                  pos = p;
                }
              }
              if (strarr[i] instanceof Token) {
                continue;
              }
              delNum = k - i;
              str = text.slice(pos, p);
              match.index -= pos;
            } else {
              pattern.lastIndex = 0;
              var match = pattern.exec(str),
                delNum = 1;
            }
            if (!match) {
              if (oneshot) {
                break;
              }
              continue;
            }
            if (lookbehind) {
              lookbehindLength = match[1] ? match[1].length : 0;
            }
            var from = match.index + lookbehindLength,
              match = match[0].slice(lookbehindLength),
              to = from + match.length,
              before = str.slice(0, from),
              after = str.slice(to);
            var args = [i, delNum];
            if (before) {
              ++i;
              pos += before.length;
              args.push(before);
            }
            var wrapped = new Token(
              token,
              inside ? _.tokenize(match, inside) : match,
              alias,
              match,
              greedy
            );
            args.push(wrapped);
            if (after) {
              args.push(after);
            }
            Array.prototype.splice.apply(strarr, args);
            if (delNum != 1)
              _.matchGrammar(text, strarr, grammar, i, pos, !0, token);
            if (oneshot) break;
          }
        }
      }
    },
    tokenize: function(text, grammar) {
      var strarr = [text];
      var rest = grammar.rest;
      if (rest) {
        for (var token in rest) {
          grammar[token] = rest[token];
        }
        delete grammar.rest;
      }
      _.matchGrammar(text, strarr, grammar, 0, 0, !1);
      return strarr;
    },
    hooks: {
      all: {},
      add: function(name, callback) {
        var hooks = _.hooks.all;
        hooks[name] = hooks[name] || [];
        hooks[name].push(callback);
      },
      run: function(name, env) {
        var callbacks = _.hooks.all[name];
        if (!callbacks || !callbacks.length) {
          return;
        }
        for (var i = 0, callback; (callback = callbacks[i++]); ) {
          callback(env);
        }
      },
    },
    Token: Token,
  };
  _self.Prism = _;
  function Token(type, content, alias, matchedStr, greedy) {
    this.type = type;
    this.content = content;
    this.alias = alias;
    this.length = (matchedStr || "").length | 0;
    this.greedy = !!greedy;
  }
  Token.stringify = function(o, language, parent) {
    if (typeof o == "string") {
      return o;
    }
    if (Array.isArray(o)) {
      return o
        .map(function(element) {
          return Token.stringify(element, language, o);
        })
        .join("");
    }
    var env = {
      type: o.type,
      content: Token.stringify(o.content, language, parent),
      tag: "span",
      classes: ["token", o.type],
      attributes: {},
      language: language,
      parent: parent,
    };
    if (o.alias) {
      var aliases = Array.isArray(o.alias) ? o.alias : [o.alias];
      Array.prototype.push.apply(env.classes, aliases);
    }
    _.hooks.run("wrap", env);
    var attributes = Object.keys(env.attributes)
      .map(function(name) {
        return (
          name +
          '="' +
          (env.attributes[name] || "").replace(/"/g, "&quot;") +
          '"'
        );
      })
      .join(" ");
    return (
      "<" +
      env.tag +
      ' class="' +
      env.classes.join(" ") +
      '"' +
      (attributes ? " " + attributes : "") +
      ">" +
      env.content +
      "</" +
      env.tag +
      ">"
    );
  };
  if (!_self.document) {
    if (!_self.addEventListener) {
      return _;
    }
    if (!_.disableWorkerMessageHandler) {
      _self.addEventListener(
        "message",
        function(evt) {
          var message = JSON.parse(evt.data),
            lang = message.language,
            code = message.code,
            immediateClose = message.immediateClose;
          _self.postMessage(_.highlight(code, _.languages[lang], lang));
          if (immediateClose) {
            _self.close();
          }
        },
        !1
      );
    }
    return _;
  }
  var script =
    document.currentScript ||
    [].slice.call(document.getElementsByTagName("script")).pop();
  if (script) {
    _.filename = script.src;
    if (!_.manual && !script.hasAttribute("data-manual")) {
      if (document.readyState !== "loading") {
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(_.highlightAll);
        } else {
          window.setTimeout(_.highlightAll, 16);
        }
      } else {
        document.addEventListener("DOMContentLoaded", _.highlightAll);
      }
    }
  }
  return _;
})(_self);
if (typeof module !== "undefined" && module.exports) {
  module.exports = Prism;
}
if (typeof global !== "undefined") {
  global.Prism = Prism;
}
(Prism.languages.markup = {
  comment: /<!--[\s\S]*?-->/,
  prolog: /<\?[\s\S]+?\?>/,
  doctype: /<!DOCTYPE[\s\S]+?>/i,
  cdata: /<!\[CDATA\[[\s\S]*?]]>/i,
  tag: {
    pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s(?:\s*[^\s>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+(?=[\s>]))|(?=[\s/>])))+)?\s*\/?>/i,
    greedy: !0,
    inside: {
      tag: {
        pattern: /^<\/?[^\s>\/]+/i,
        inside: { punctuation: /^<\/?/, namespace: /^[^\s>\/:]+:/ },
      },
      "attr-value": {
        pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,
        inside: {
          punctuation: [/^=/, { pattern: /^(\s*)["']|["']$/, lookbehind: !0 }],
        },
      },
      punctuation: /\/?>/,
      "attr-name": {
        pattern: /[^\s>\/]+/,
        inside: { namespace: /^[^\s>\/:]+:/ },
      },
    },
  },
  entity: /&#?[\da-z]{1,8};/i,
}),
  (Prism.languages.markup.tag.inside["attr-value"].inside.entity =
    Prism.languages.markup.entity),
  Prism.hooks.add("wrap", function(a) {
    "entity" === a.type &&
      (a.attributes.title = a.content.replace(/&amp;/, "&"));
  }),
  Object.defineProperty(Prism.languages.markup.tag, "addInlined", {
    value: function(a, e) {
      var s = {};
      (s["language-" + e] = {
        pattern: /(^<!\[CDATA\[)[\s\S]+?(?=\]\]>$)/i,
        lookbehind: !0,
        inside: Prism.languages[e],
      }),
        (s.cdata = /^<!\[CDATA\[|\]\]>$/i);
      var n = {
        "included-cdata": { pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i, inside: s },
      };
      n["language-" + e] = { pattern: /[\s\S]+/, inside: Prism.languages[e] };
      var i = {};
      (i[a] = {
        pattern: RegExp(
          "(<__[\\s\\S]*?>)(?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>\\s*|[\\s\\S])*?(?=<\\/__>)".replace(
            /__/g,
            a
          ),
          "i"
        ),
        lookbehind: !0,
        greedy: !0,
        inside: n,
      }),
        Prism.languages.insertBefore("markup", "cdata", i);
    },
  }),
  (Prism.languages.xml = Prism.languages.extend("markup", {})),
  (Prism.languages.html = Prism.languages.markup),
  (Prism.languages.mathml = Prism.languages.markup),
  (Prism.languages.svg = Prism.languages.markup);
!(function(s) {
  var e = /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;
  (s.languages.css = {
    comment: /\/\*[\s\S]*?\*\//,
    atrule: {
      pattern: /@[\w-]+?[\s\S]*?(?:;|(?=\s*\{))/i,
      inside: { rule: /@[\w-]+/ },
    },
    url: RegExp("url\\((?:" + e.source + "|.*?)\\)", "i"),
    selector: RegExp("[^{}\\s](?:[^{};\"']|" + e.source + ")*?(?=\\s*\\{)"),
    string: { pattern: e, greedy: !0 },
    property: /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
    important: /!important\b/i,
    function: /[-a-z0-9]+(?=\()/i,
    punctuation: /[(){};:,]/,
  }),
    (s.languages.css.atrule.inside.rest = s.languages.css);
  var a = s.languages.markup;
  a &&
    (a.tag.addInlined("style", "css"),
    s.languages.insertBefore(
      "inside",
      "attr-value",
      {
        "style-attr": {
          pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
          inside: {
            "attr-name": { pattern: /^\s*style/i, inside: a.tag.inside },
            punctuation: /^\s*=\s*['"]|['"]\s*$/,
            "attr-value": { pattern: /.+/i, inside: s.languages.css },
          },
          alias: "language-css",
        },
      },
      a.tag
    ));
})(Prism);
Prism.languages.clike = {
  comment: [
    { pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/, lookbehind: !0 },
    { pattern: /(^|[^\\:])\/\/.*/, lookbehind: !0, greedy: !0 },
  ],
  string: {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: !0,
  },
  "class-name": {
    pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,
    lookbehind: !0,
    inside: { punctuation: /[.\\]/ },
  },
  keyword: /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
  boolean: /\b(?:true|false)\b/,
  function: /\w+(?=\()/,
  number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
  operator: /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
  punctuation: /[{}[\];(),.:]/,
};
(Prism.languages.javascript = Prism.languages.extend("clike", {
  "class-name": [
    Prism.languages.clike["class-name"],
    {
      pattern: /(^|[^$\w\xA0-\uFFFF])[_$A-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\.(?:prototype|constructor))/,
      lookbehind: !0,
    },
  ],
  keyword: [
    { pattern: /((?:^|})\s*)(?:catch|finally)\b/, lookbehind: !0 },
    {
      pattern: /(^|[^.])\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
      lookbehind: !0,
    },
  ],
  number: /\b(?:(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+)n?|\d+n|NaN|Infinity)\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,
  function: /[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
  operator: /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/,
})),
  (Prism.languages.javascript[
    "class-name"
  ][0].pattern = /(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/),
  Prism.languages.insertBefore("javascript", "keyword", {
    regex: {
      pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})\]]))/,
      lookbehind: !0,
      greedy: !0,
    },
    "function-variable": {
      pattern: /[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/,
      alias: "function",
    },
    parameter: [
      {
        pattern: /(function(?:\s+[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)?\s*\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\))/,
        lookbehind: !0,
        inside: Prism.languages.javascript,
      },
      {
        pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=>)/i,
        inside: Prism.languages.javascript,
      },
      {
        pattern: /(\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*=>)/,
        lookbehind: !0,
        inside: Prism.languages.javascript,
      },
      {
        pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*\s*)\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*\{)/,
        lookbehind: !0,
        inside: Prism.languages.javascript,
      },
    ],
    constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/,
  }),
  Prism.languages.insertBefore("javascript", "string", {
    "template-string": {
      pattern: /`(?:\\[\s\S]|\${[^}]+}|[^\\`])*`/,
      greedy: !0,
      inside: {
        interpolation: {
          pattern: /\${[^}]+}/,
          inside: {
            "interpolation-punctuation": {
              pattern: /^\${|}$/,
              alias: "punctuation",
            },
            rest: Prism.languages.javascript,
          },
        },
        string: /[\s\S]+/,
      },
    },
  }),
  Prism.languages.markup &&
    Prism.languages.markup.tag.addInlined("script", "javascript"),
  (Prism.languages.js = Prism.languages.javascript);
!(function(h) {
  function v(e, n) {
    return "___" + e.toUpperCase() + n + "___";
  }
  Object.defineProperties((h.languages["markup-templating"] = {}), {
    buildPlaceholders: {
      value: function(a, r, e, o) {
        if (a.language === r) {
          var c = (a.tokenStack = []);
          (a.code = a.code.replace(e, function(e) {
            if ("function" == typeof o && !o(e)) return e;
            for (var n, t = c.length; -1 !== a.code.indexOf((n = v(r, t))); )
              ++t;
            return (c[t] = e), n;
          })),
            (a.grammar = h.languages.markup);
        }
      },
    },
    tokenizePlaceholders: {
      value: function(p, k) {
        if (p.language === k && p.tokenStack) {
          p.grammar = h.languages[k];
          var m = 0,
            d = Object.keys(p.tokenStack);
          !(function e(n) {
            for (var t = 0; t < n.length && !(m >= d.length); t++) {
              var a = n[t];
              if (
                "string" == typeof a ||
                (a.content && "string" == typeof a.content)
              ) {
                var r = d[m],
                  o = p.tokenStack[r],
                  c = "string" == typeof a ? a : a.content,
                  i = v(k, r),
                  u = c.indexOf(i);
                if (-1 < u) {
                  ++m;
                  var g = c.substring(0, u),
                    l = new h.Token(
                      k,
                      h.tokenize(o, p.grammar),
                      "language-" + k,
                      o
                    ),
                    s = c.substring(u + i.length),
                    f = [];
                  g && f.push.apply(f, e([g])),
                    f.push(l),
                    s && f.push.apply(f, e([s])),
                    "string" == typeof a
                      ? n.splice.apply(n, [t, 1].concat(f))
                      : (a.content = f);
                }
              } else a.content && e(a.content);
            }
            return n;
          })(p.tokens);
        }
      },
    },
  });
})(Prism);
!(function(n) {
  (n.languages.php = n.languages.extend("clike", {
    keyword: /\b(?:__halt_compiler|abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|namespace|new|or|parent|print|private|protected|public|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield)\b/i,
    boolean: { pattern: /\b(?:false|true)\b/i, alias: "constant" },
    constant: [/\b[A-Z_][A-Z0-9_]*\b/, /\b(?:null)\b/i],
    comment: {
      pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
      lookbehind: !0,
    },
  })),
    n.languages.insertBefore("php", "string", {
      "shell-comment": {
        pattern: /(^|[^\\])#.*/,
        lookbehind: !0,
        alias: "comment",
      },
    }),
    n.languages.insertBefore("php", "comment", {
      delimiter: { pattern: /\?>$|^<\?(?:php(?=\s)|=)?/i, alias: "important" },
    }),
    n.languages.insertBefore("php", "keyword", {
      variable: /\$+(?:\w+\b|(?={))/i,
      package: {
        pattern: /(\\|namespace\s+|use\s+)[\w\\]+/,
        lookbehind: !0,
        inside: { punctuation: /\\/ },
      },
    }),
    n.languages.insertBefore("php", "operator", {
      property: { pattern: /(->)[\w]+/, lookbehind: !0 },
    });
  var e = {
    pattern: /{\$(?:{(?:{[^{}]+}|[^{}]+)}|[^{}])+}|(^|[^\\{])\$+(?:\w+(?:\[.+?]|->\w+)*)/,
    lookbehind: !0,
    inside: { rest: n.languages.php },
  };
  n.languages.insertBefore("php", "string", {
    "nowdoc-string": {
      pattern: /<<<'([^']+)'(?:\r\n?|\n)(?:.*(?:\r\n?|\n))*?\1;/,
      greedy: !0,
      alias: "string",
      inside: {
        delimiter: {
          pattern: /^<<<'[^']+'|[a-z_]\w*;$/i,
          alias: "symbol",
          inside: { punctuation: /^<<<'?|[';]$/ },
        },
      },
    },
    "heredoc-string": {
      pattern: /<<<(?:"([^"]+)"(?:\r\n?|\n)(?:.*(?:\r\n?|\n))*?\1;|([a-z_]\w*)(?:\r\n?|\n)(?:.*(?:\r\n?|\n))*?\2;)/i,
      greedy: !0,
      alias: "string",
      inside: {
        delimiter: {
          pattern: /^<<<(?:"[^"]+"|[a-z_]\w*)|[a-z_]\w*;$/i,
          alias: "symbol",
          inside: { punctuation: /^<<<"?|[";]$/ },
        },
        interpolation: e,
      },
    },
    "single-quoted-string": {
      pattern: /'(?:\\[\s\S]|[^\\'])*'/,
      greedy: !0,
      alias: "string",
    },
    "double-quoted-string": {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: !0,
      alias: "string",
      inside: { interpolation: e },
    },
  }),
    delete n.languages.php.string,
    n.hooks.add("before-tokenize", function(e) {
      if (/<\?/.test(e.code)) {
        n.languages["markup-templating"].buildPlaceholders(
          e,
          "php",
          /<\?(?:[^"'/#]|\/(?![*/])|("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|(?:\/\/|#)(?:[^?\n\r]|\?(?!>))*|\/\*[\s\S]*?(?:\*\/|$))*?(?:\?>|$)/gi
        );
      }
    }),
    n.hooks.add("after-tokenize", function(e) {
      n.languages["markup-templating"].tokenizePlaceholders(e, "php");
    });
})(Prism);
!(function(e) {
  var a = {
    variable: [
      {
        pattern: /\$?\(\([\s\S]+?\)\)/,
        inside: {
          variable: [
            { pattern: /(^\$\(\([\s\S]+)\)\)/, lookbehind: !0 },
            /^\$\(\(/,
          ],
          number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee]-?\d+)?/,
          operator: /--?|-=|\+\+?|\+=|!=?|~|\*\*?|\*=|\/=?|%=?|<<=?|>>=?|<=?|>=?|==?|&&?|&=|\^=?|\|\|?|\|=|\?|:/,
          punctuation: /\(\(?|\)\)?|,|;/,
        },
      },
      {
        pattern: /\$\([^)]+\)|`[^`]+`/,
        greedy: !0,
        inside: { variable: /^\$\(|^`|\)$|`$/ },
      },
      /\$(?:[\w#?*!@]+|\{[^}]+\})/i,
    ],
  };
  e.languages.bash = {
    shebang: {
      pattern: /^#!\s*\/bin\/bash|^#!\s*\/bin\/sh/,
      alias: "important",
    },
    comment: { pattern: /(^|[^"{\\])#.*/, lookbehind: !0 },
    string: [
      {
        pattern: /((?:^|[^<])<<\s*)["']?(\w+?)["']?\s*\r?\n(?:[\s\S])*?\r?\n\2/,
        lookbehind: !0,
        greedy: !0,
        inside: a,
      },
      {
        pattern: /(["'])(?:\\[\s\S]|\$\([^)]+\)|`[^`]+`|(?!\1)[^\\])*\1/,
        greedy: !0,
        inside: a,
      },
    ],
    variable: a.variable,
    function: {
      pattern: /(^|[\s;|&])(?:add|alias|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|builtin|bzip2|cal|cat|cd|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|comm|command|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|du|egrep|eject|enable|env|ethtool|eval|exec|expand|expect|export|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|getopts|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|hash|head|help|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|jobs|join|kill|killall|less|link|ln|locate|logname|logout|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|popd|pr|printcap|printenv|printf|ps|pushd|pv|pwd|quota|quotacheck|quotactl|ram|rar|rcp|read|readarray|readonly|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|shift|shopt|shutdown|sleep|slocate|sort|source|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|tail|tar|tee|test|time|timeout|times|top|touch|tr|traceroute|trap|tsort|tty|type|ulimit|umask|umount|unalias|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zip|zypper)(?=$|[\s;|&])/,
      lookbehind: !0,
    },
    keyword: {
      pattern: /(^|[\s;|&])(?:let|:|\.|if|then|else|elif|fi|for|break|continue|while|in|case|function|select|do|done|until|echo|exit|return|set|declare)(?=$|[\s;|&])/,
      lookbehind: !0,
    },
    boolean: {
      pattern: /(^|[\s;|&])(?:true|false)(?=$|[\s;|&])/,
      lookbehind: !0,
    },
    operator: /&&?|\|\|?|==?|!=?|<<<?|>>|<=?|>=?|=~/,
    punctuation: /\$?\(\(?|\)\)?|\.\.|[{}[\];]/,
  };
  var t = a.variable[1].inside;
  (t.string = e.languages.bash.string),
    (t.function = e.languages.bash.function),
    (t.keyword = e.languages.bash.keyword),
    (t.boolean = e.languages.bash.boolean),
    (t.operator = e.languages.bash.operator),
    (t.punctuation = e.languages.bash.punctuation),
    (e.languages.shell = e.languages.bash);
})(Prism);
!(function(i) {
  var t = i.util.clone(i.languages.javascript);
  (i.languages.jsx = i.languages.extend("markup", t)),
    (i.languages.jsx.tag.pattern = /<\/?(?:[\w.:-]+\s*(?:\s+(?:[\w.:-]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s{'">=]+|\{(?:\{(?:\{[^}]*\}|[^{}])*\}|[^{}])+\}))?|\{\.{3}[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*\}))*\s*\/?)?>/i),
    (i.languages.jsx.tag.inside.tag.pattern = /^<\/?[^\s>\/]*/i),
    (i.languages.jsx.tag.inside[
      "attr-value"
    ].pattern = /=(?!\{)(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">]+)/i),
    (i.languages.jsx.tag.inside.tag.inside[
      "class-name"
    ] = /^[A-Z]\w*(?:\.[A-Z]\w*)*$/),
    i.languages.insertBefore(
      "inside",
      "attr-name",
      {
        spread: {
          pattern: /\{\.{3}[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*\}/,
          inside: { punctuation: /\.{3}|[{}.]/, "attr-value": /\w+/ },
        },
      },
      i.languages.jsx.tag
    ),
    i.languages.insertBefore(
      "inside",
      "attr-value",
      {
        script: {
          pattern: /=(\{(?:\{(?:\{[^}]*\}|[^}])*\}|[^}])+\})/i,
          inside: {
            "script-punctuation": { pattern: /^=(?={)/, alias: "punctuation" },
            rest: i.languages.jsx,
          },
          alias: "language-javascript",
        },
      },
      i.languages.jsx.tag
    );
  var o = function(t) {
      return t
        ? "string" == typeof t
          ? t
          : "string" == typeof t.content
          ? t.content
          : t.content.map(o).join("")
        : "";
    },
    p = function(t) {
      for (var n = [], e = 0; e < t.length; e++) {
        var a = t[e],
          s = !1;
        if (
          ("string" != typeof a &&
            ("tag" === a.type && a.content[0] && "tag" === a.content[0].type
              ? "</" === a.content[0].content[0].content
                ? 0 < n.length &&
                  n[n.length - 1].tagName === o(a.content[0].content[1]) &&
                  n.pop()
                : "/>" === a.content[a.content.length - 1].content ||
                  n.push({
                    tagName: o(a.content[0].content[1]),
                    openedBraces: 0,
                  })
              : 0 < n.length && "punctuation" === a.type && "{" === a.content
              ? n[n.length - 1].openedBraces++
              : 0 < n.length &&
                0 < n[n.length - 1].openedBraces &&
                "punctuation" === a.type &&
                "}" === a.content
              ? n[n.length - 1].openedBraces--
              : (s = !0)),
          (s || "string" == typeof a) &&
            0 < n.length &&
            0 === n[n.length - 1].openedBraces)
        ) {
          var g = o(a);
          e < t.length - 1 &&
            ("string" == typeof t[e + 1] || "plain-text" === t[e + 1].type) &&
            ((g += o(t[e + 1])), t.splice(e + 1, 1)),
            0 < e &&
              ("string" == typeof t[e - 1] || "plain-text" === t[e - 1].type) &&
              ((g = o(t[e - 1]) + g), t.splice(e - 1, 1), e--),
            (t[e] = new i.Token("plain-text", g, null, g));
        }
        a.content && "string" != typeof a.content && p(a.content);
      }
    };
  i.hooks.add("after-tokenize", function(t) {
    ("jsx" !== t.language && "tsx" !== t.language) || p(t.tokens);
  });
})(Prism);
!(function() {
  if ("undefined" != typeof self && self.Prism && self.document) {
    var r = [],
      i = {},
      n = function() {};
    Prism.plugins.toolbar = {};
    var t = (Prism.plugins.toolbar.registerButton = function(t, n) {
        var e;
        (e =
          "function" == typeof n
            ? n
            : function(t) {
                var e;
                return (
                  "function" == typeof n.onClick
                    ? (((e = document.createElement("button")).type = "button"),
                      e.addEventListener("click", function() {
                        n.onClick.call(this, t);
                      }))
                    : "string" == typeof n.url
                    ? ((e = document.createElement("a")).href = n.url)
                    : (e = document.createElement("span")),
                  (e.textContent = n.text),
                  e
                );
              }),
          t in i
            ? console.warn(
                'There is a button with the key "' + t + '" registered already.'
              )
            : r.push((i[t] = e));
      }),
      e = (Prism.plugins.toolbar.hook = function(a) {
        var t = a.element.parentNode;
        if (
          t &&
          /pre/i.test(t.nodeName) &&
          !t.parentNode.classList.contains("code-toolbar")
        ) {
          var e = document.createElement("div");
          e.classList.add("code-toolbar"),
            t.parentNode.insertBefore(e, t),
            e.appendChild(t);
          var o = document.createElement("div");
          o.classList.add("toolbar"),
            document.body.hasAttribute("data-toolbar-order") &&
              (r = document.body
                .getAttribute("data-toolbar-order")
                .split(",")
                .map(function(t) {
                  return i[t] || n;
                })),
            r.forEach(function(t) {
              var e = t(a);
              if (e) {
                var n = document.createElement("div");
                n.classList.add("toolbar-item"),
                  n.appendChild(e),
                  o.appendChild(n);
              }
            }),
            e.appendChild(o);
        }
      });
    t("label", function(t) {
      var e = t.element.parentNode;
      if (e && /pre/i.test(e.nodeName) && e.hasAttribute("data-label")) {
        var n,
          a,
          o = e.getAttribute("data-label");
        try {
          a = document.querySelector("template#" + o);
        } catch (t) {}
        return (
          a
            ? (n = a.content)
            : (e.hasAttribute("data-url")
                ? ((n = document.createElement("a")).href = e.getAttribute(
                    "data-url"
                  ))
                : (n = document.createElement("span")),
              (n.textContent = o)),
          n
        );
      }
    }),
      Prism.hooks.add("complete", e);
  }
})();
!(function(n) {
  var i = {};
  function o(t) {
    if (i[t]) return i[t].exports;
    var e = (i[t] = { i: t, l: !1, exports: {} });
    return n[t].call(e.exports, e, e.exports, o), (e.l = !0), e.exports;
  }
  (o.m = n),
    (o.c = i),
    (o.d = function(t, e, n) {
      o.o(t, e) || Object.defineProperty(t, e, { enumerable: !0, get: n });
    }),
    (o.r = function(t) {
      "undefined" != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
        Object.defineProperty(t, "__esModule", { value: !0 });
    }),
    (o.t = function(e, t) {
      if ((1 & t && (e = o(e)), 8 & t)) return e;
      if (4 & t && "object" == typeof e && e && e.__esModule) return e;
      var n = Object.create(null);
      if (
        (o.r(n),
        Object.defineProperty(n, "default", { enumerable: !0, value: e }),
        2 & t && "string" != typeof e)
      )
        for (var i in e)
          o.d(
            n,
            i,
            function(t) {
              return e[t];
            }.bind(null, i)
          );
      return n;
    }),
    (o.n = function(t) {
      var e =
        t && t.__esModule
          ? function() {
              return t.default;
            }
          : function() {
              return t;
            };
      return o.d(e, "a", e), e;
    }),
    (o.o = function(t, e) {
      return Object.prototype.hasOwnProperty.call(t, e);
    }),
    (o.p = ""),
    o((o.s = 4));
})([
  function(t, e, n) {
    /*!
     * Splide.js
     * Version  : 2.4.12
     * License  : MIT
     * Copyright: 2020 Naotoshi Fujita
     */
    var i;
    window,
      (i = function() {
        return (
          (i = {}),
          (o.m = n = [
            function(t, e, n) {
              "use strict";
              n.r(e),
                n.d(e, "default", function() {
                  return Rt;
                });
              var s = {};
              n.r(s),
                n.d(s, "CREATED", function() {
                  return z;
                }),
                n.d(s, "MOUNTED", function() {
                  return V;
                }),
                n.d(s, "IDLE", function() {
                  return F;
                }),
                n.d(s, "MOVING", function() {
                  return U;
                }),
                n.d(s, "DESTROYED", function() {
                  return G;
                });
              function i() {
                return (i =
                  Object.assign ||
                  function(t) {
                    for (var e = 1; e < arguments.length; e++) {
                      var n = arguments[e];
                      for (var i in n)
                        Object.prototype.hasOwnProperty.call(n, i) &&
                          (t[i] = n[i]);
                    }
                    return t;
                  }).apply(this, arguments);
              }
              var b = Object.keys;
              function g(n, i) {
                b(n).some(function(t, e) {
                  return i(n[t], t, e);
                });
              }
              function v(e) {
                return b(e).map(function(t) {
                  return e[t];
                });
              }
              function o(t) {
                return "object" == typeof t;
              }
              function l(t, e) {
                var n = i({}, t);
                return (
                  g(e, function(t, e) {
                    o(t)
                      ? (o(n[e]) || (n[e] = {}), (n[e] = l(n[e], t)))
                      : (n[e] = t);
                  }),
                  n
                );
              }
              function r(t) {
                return Array.isArray(t) ? t : [t];
              }
              function y(t, e, n) {
                return Math.min(Math.max(t, n < e ? n : e), n < e ? e : n);
              }
              function h(t, e) {
                var n = 0;
                return t.replace(/%s/g, function() {
                  return r(e)[n++];
                });
              }
              function w(t) {
                var e = typeof t;
                return "number" == e && 0 < t
                  ? parseFloat(t) + "px"
                  : "string" == e
                  ? t
                  : "";
              }
              function m(t) {
                return t < 10 ? "0" + t : t;
              }
              function E(t, e) {
                var n;
                return (
                  "string" == typeof e &&
                    (T((n = f("div", {})), { position: "absolute", width: e }),
                    k(t, n),
                    (e = n.clientWidth),
                    P(n)),
                  +e || 0
                );
              }
              function c(t, e) {
                return t ? t.querySelector(e.split(" ")[0]) : null;
              }
              function _(t, e) {
                return u(t, e)[0];
              }
              function u(t, e) {
                return t
                  ? v(t.children).filter(function(t) {
                      return L(t, e.split(" ")[0]) || t.tagName === e;
                    })
                  : [];
              }
              function f(t, e) {
                var n = document.createElement(t);
                return (
                  g(e, function(t, e) {
                    return j(n, e, t);
                  }),
                  n
                );
              }
              function d(t) {
                var e = f("div", {});
                return (e.innerHTML = t), e.firstChild;
              }
              function P(t) {
                r(t).forEach(function(t) {
                  var e;
                  !t || ((e = t.parentElement) && e.removeChild(t));
                });
              }
              function k(t, e) {
                t && t.appendChild(e);
              }
              function S(t, e) {
                var n;
                t && e && (n = e.parentElement) && n.insertBefore(t, e);
              }
              function T(n, t) {
                n &&
                  g(t, function(t, e) {
                    null !== t && (n.style[e] = t);
                  });
              }
              function a(e, t, n) {
                e &&
                  r(t).forEach(function(t) {
                    t && e.classList[n ? "remove" : "add"](t);
                  });
              }
              function x(t, e) {
                a(t, e, !1);
              }
              function O(t, e) {
                a(t, e, !0);
              }
              function L(t, e) {
                return !!t && t.classList.contains(e);
              }
              function j(t, e, n) {
                t && t.setAttribute(e, n);
              }
              function M(t, e) {
                return t ? t.getAttribute(e) : "";
              }
              function R(t, e) {
                r(e).forEach(function(e) {
                  r(t).forEach(function(t) {
                    return t && t.removeAttribute(e);
                  });
                });
              }
              function C(t) {
                return t.getBoundingClientRect();
              }
              function p(l, c) {
                var u, d;
                return {
                  mount: function() {
                    (u = c.Elements.list),
                      l.on(
                        "transitionend",
                        function(t) {
                          t.target === u && d && d();
                        },
                        u
                      );
                  },
                  start: function(t, e, n, i, o) {
                    var r = l.options,
                      s = c.Controller.edgeIndex,
                      a = r.speed;
                    (d = o),
                      l.is(Y) &&
                        ((0 === n && s <= e) || (s <= n && 0 === e)) &&
                        (a = r.rewindSpeed || a),
                      T(u, {
                        transition: "transform " + a + "ms " + r.easing,
                        transform: "translate(" + i.x + "px," + i.y + "px)",
                      });
                  },
                };
              }
              function A(n, s) {
                function a(t) {
                  var e = n.options;
                  T(s.Elements.slides[t], {
                    transition: "opacity " + e.speed + "ms " + e.easing,
                  });
                }
                return {
                  mount: function() {
                    a(n.index);
                  },
                  start: function(t, e, n, i, o) {
                    var r = s.Elements.track;
                    T(r, { height: w(r.clientHeight) }),
                      a(e),
                      o(),
                      T(r, { height: "" });
                  },
                };
              }
              var Y = "slide",
                W = "loop",
                I = "fade";
              var X = "[SPLIDE]";
              function H(t) {
                // console.error(X + " " + t);
              }
              function D(t, e) {
                if (!t) throw new Error(e);
              }
              var N = "splide",
                B = {
                  active: "is-active",
                  visible: "is-visible",
                  loading: "is-loading",
                },
                q = {
                  type: "slide",
                  rewind: !1,
                  speed: 400,
                  rewindSpeed: 0,
                  waitForTransition: !0,
                  width: 0,
                  height: 0,
                  fixedWidth: 0,
                  fixedHeight: 0,
                  heightRatio: 0,
                  autoWidth: !1,
                  autoHeight: !1,
                  perPage: 1,
                  perMove: 0,
                  clones: 0,
                  start: 0,
                  focus: !1,
                  gap: 0,
                  padding: 0,
                  arrows: !0,
                  arrowPath: "",
                  pagination: !0,
                  autoplay: !1,
                  interval: 5e3,
                  pauseOnHover: !0,
                  pauseOnFocus: !0,
                  resetProgress: !0,
                  lazyLoad: !1,
                  preloadPages: 1,
                  easing: "cubic-bezier(.42,.65,.27,.99)",
                  keyboard: "global",
                  drag: !0,
                  dragAngleThreshold: 30,
                  swipeDistanceThreshold: 150,
                  flickVelocityThreshold: 0.6,
                  flickPower: 600,
                  flickMaxPages: 1,
                  direction: "ltr",
                  cover: !1,
                  accessibility: !0,
                  slideFocus: !0,
                  isNavigation: !1,
                  trimSpace: !0,
                  updateOnMove: !1,
                  throttle: 100,
                  destroy: !1,
                  breakpoints: !1,
                  classes: {
                    root: N,
                    slider: N + "__slider",
                    track: N + "__track",
                    list: N + "__list",
                    slide: N + "__slide",
                    container: N + "__slide__container",
                    arrows: N + "__arrows",
                    arrow: N + "__arrow",
                    prev: N + "__arrow--prev",
                    next: N + "__arrow--next",
                    pagination: N + "__pagination",
                    page: N + "__pagination__page",
                    clone: N + "__slide--clone",
                    progress: N + "__progress",
                    bar: N + "__progress__bar",
                    autoplay: N + "__autoplay",
                    play: N + "__play",
                    pause: N + "__pause",
                    spinner: N + "__spinner",
                    sr: N + "__sr",
                  },
                  i18n: {
                    prev: "Previous slide",
                    next: "Next slide",
                    first: "Go to first slide",
                    last: "Go to last slide",
                    slideX: "Go to slide %s",
                    pageX: "Go to page %s",
                    play: "Start autoplay",
                    pause: "Pause autoplay",
                  },
                },
                z = 1,
                V = 2,
                F = 3,
                U = 4,
                G = 5;
              function K(t, e) {
                for (var n = 0; n < e.length; n++) {
                  var i = e[n];
                  (i.enumerable = i.enumerable || !1),
                    (i.configurable = !0),
                    "value" in i && (i.writable = !0),
                    Object.defineProperty(t, i.key, i);
                }
              }
              function $(t) {
                var e = M(t.root, "data-splide");
                if (e)
                  try {
                    t.options = JSON.parse(e);
                  } catch (t) {
                    H(t.message);
                  }
                return {
                  mount: function() {
                    t.State.is(z) && (t.index = t.options.start);
                  },
                };
              }
              function J(h, o) {
                var t,
                  i = h.root,
                  r = h.classes,
                  p = [];
                i.id ||
                  ((window.splide = window.splide || {}),
                  (t = window.splide.uid || 0),
                  (window.splide.uid = ++t),
                  (i.id = "splide" + m(t)));
                var s = {
                  mount: function() {
                    var t = this;
                    this.init(),
                      h
                        .on("refresh", function() {
                          t.destroy(), t.init();
                        })
                        .on("updated", function() {
                          O(i, e()), x(i, e());
                        });
                  },
                  destroy: function() {
                    p.forEach(function(t) {
                      t.destroy();
                    }),
                      (p = []),
                      O(i, e());
                  },
                  init: function() {
                    var n = this;
                    !(function() {
                      (s.slider = _(i, r.slider)),
                        (s.track = c(i, "." + r.track)),
                        (s.list = _(s.track, r.list)),
                        D(s.track && s.list, "Track or list was not found."),
                        (s.slides = u(s.list, r.slide));
                      var t = a(r.arrows);
                      s.arrows = {
                        prev: c(t, "." + r.prev),
                        next: c(t, "." + r.next),
                      };
                      var e = a(r.autoplay);
                      (s.bar = c(a(r.progress), "." + r.bar)),
                        (s.play = c(e, "." + r.play)),
                        (s.pause = c(e, "." + r.pause)),
                        (s.track.id = s.track.id || i.id + "-track"),
                        (s.list.id = s.list.id || i.id + "-list");
                    })(),
                      x(i, e()),
                      this.slides.forEach(function(t, e) {
                        n.register(t, e, -1);
                      });
                  },
                  register: function(t, e, n) {
                    var o,
                      i,
                      r,
                      s,
                      a,
                      l,
                      c,
                      u =
                        ((i = e),
                        (r = n),
                        (s = t),
                        (a = (o = h).options.updateOnMove),
                        (l =
                          "ready.slide updated.slide resize.slide moved.slide" +
                          (a ? " move.slide" : "")),
                        (c = {
                          slide: s,
                          index: i,
                          realIndex: r,
                          container: _(s, o.classes.container),
                          isClone: -1 < r,
                          mount: function() {
                            var t = this;
                            this.isClone ||
                              (s.id = o.root.id + "-slide" + m(i + 1)),
                              o
                                .on(l, function() {
                                  return t.update();
                                })
                                .on(ot, f)
                                .on(
                                  "click",
                                  function() {
                                    return o.emit("click", t);
                                  },
                                  s
                                ),
                              a &&
                                o.on("move.slide", function(t) {
                                  t === r && d(!0, !1);
                                }),
                              T(s, { display: "" }),
                              (this.styles = M(s, "style") || "");
                          },
                          destroy: function() {
                            o
                              .off(l)
                              .off(ot)
                              .off("click", s),
                              O(s, v(B)),
                              f(),
                              R(this.container, "style");
                          },
                          update: function() {
                            d(this.isActive(), !1), d(this.isVisible(), !0);
                          },
                          isActive: function() {
                            return o.index === i;
                          },
                          isVisible: function() {
                            var t = this.isActive();
                            if (o.is(I) || t) return t;
                            var e = C(o.Components.Elements.track),
                              n = C(s);
                            return o.options.direction === it
                              ? e.top <= n.top && n.bottom <= e.bottom
                              : e.left <= n.left && n.right <= e.right;
                          },
                          isWithin: function(t, e) {
                            var n = Math.abs(t - i);
                            return (
                              o.is(Y) ||
                                this.isClone ||
                                (n = Math.min(n, o.length - n)),
                              n < e
                            );
                          },
                        }));
                    function d(t, e) {
                      var n = e ? "visible" : "active",
                        i = B[n];
                      t
                        ? (x(s, i), o.emit(n, c))
                        : L(s, i) &&
                          (O(s, i), o.emit(e ? "hidden" : "inactive", c));
                    }
                    function f() {
                      j(s, "style", c.styles);
                    }
                    u.mount(), p.push(u);
                  },
                  getSlide: function(e) {
                    return p.filter(function(t) {
                      return t.index === e;
                    })[0];
                  },
                  getSlides: function(t) {
                    return t
                      ? p
                      : p.filter(function(t) {
                          return !t.isClone;
                        });
                  },
                  getSlidesByPage: function(t) {
                    var n = o.Controller.toIndex(t),
                      e = h.options,
                      i = !1 !== e.focus ? 1 : e.perPage;
                    return p.filter(function(t) {
                      var e = t.index;
                      return n <= e && e < n + i;
                    });
                  },
                  add: function(t, e, n) {
                    var i, o, r, s, a;
                    "string" == typeof t && (t = d(t)),
                      t instanceof Element &&
                        ((i = this.slides[e]),
                        T(t, { display: "none" }),
                        i
                          ? (S(t, i), this.slides.splice(e, 0, t))
                          : (k(this.list, t), this.slides.push(t)),
                        (o = function() {
                          n && n(t);
                        }),
                        (s = t.querySelectorAll("img")),
                        (a = s.length)
                          ? ((r = 0),
                            g(s, function(t) {
                              t.onload = t.onerror = function() {
                                ++r === a && o();
                              };
                            }))
                          : o());
                  },
                  remove: function(t) {
                    P(this.slides.splice(t, 1)[0]);
                  },
                  each: function(t) {
                    p.forEach(t);
                  },
                  get length() {
                    return this.slides.length;
                  },
                  get total() {
                    return p.length;
                  },
                };
                function e() {
                  var t = r.root,
                    e = h.options;
                  return [
                    t + "--" + e.type,
                    t + "--" + e.direction,
                    e.drag ? t + "--draggable" : "",
                    e.isNavigation ? t + "--nav" : "",
                    B.active,
                  ];
                }
                function a(t) {
                  return _(i, t) || _(s.slider, t);
                }
                return s;
              }
              function Q(r, i) {
                var s,
                  n,
                  a = {
                    mount: function() {
                      (s = r.options),
                        (n = r.is(W)),
                        r
                          .on("move", function(t) {
                            r.index = t;
                          })
                          .on("updated refresh", function(t) {
                            (s = t || s),
                              (r.index = y(r.index, 0, a.edgeIndex));
                          });
                    },
                    go: function(t, e) {
                      var n = this.trim(this.parse(t));
                      i.Track.go(n, this.rewind(n), e);
                    },
                    parse: function(t) {
                      var e = r.index,
                        n = String(t).match(/([+\-<>]+)(\d+)?/),
                        i = n ? n[1] : "",
                        o = n ? parseInt(n[2]) : 0;
                      switch (i) {
                        case "+":
                          e += o || 1;
                          break;
                        case "-":
                          e -= o || 1;
                          break;
                        case ">":
                        case "<":
                          e = (function(t, e, n) {
                            if (-1 < t) return a.toIndex(t);
                            var i = s.perMove,
                              o = n ? -1 : 1;
                            if (i) return e + i * o;
                            return a.toIndex(a.toPage(e) + o);
                          })(o, e, "<" === i);
                          break;
                        default:
                          e = parseInt(t);
                      }
                      return e;
                    },
                    toIndex: function(t) {
                      if (o()) return t;
                      var e = r.length,
                        n = s.perPage,
                        i = t * n;
                      return (
                        e - n <= (i -= (this.pageLength * n - e) * rt(i / e)) &&
                          i < e &&
                          (i = e - n),
                        i
                      );
                    },
                    toPage: function(t) {
                      if (o()) return t;
                      var e = r.length,
                        n = s.perPage;
                      return rt(e - n <= t && t < e ? (e - 1) / n : t / n);
                    },
                    trim: function(t) {
                      return (
                        n ||
                          (t = s.rewind
                            ? this.rewind(t)
                            : y(t, 0, this.edgeIndex)),
                        t
                      );
                    },
                    rewind: function(t) {
                      var e = this.edgeIndex;
                      if (n) {
                        for (; e < t; ) t -= e + 1;
                        for (; t < 0; ) t += e + 1;
                      } else e < t ? (t = 0) : t < 0 && (t = e);
                      return t;
                    },
                    isRtl: function() {
                      return s.direction === nt;
                    },
                    get pageLength() {
                      var t = r.length;
                      return o() ? t : Math.ceil(t / s.perPage);
                    },
                    get edgeIndex() {
                      var t = r.length;
                      return t
                        ? o() || s.isNavigation || n
                          ? t - 1
                          : t - s.perPage
                        : 0;
                    },
                    get prevIndex() {
                      var t = r.index - 1;
                      return (
                        (n || s.rewind) && (t = this.rewind(t)), -1 < t ? t : -1
                      );
                    },
                    get nextIndex() {
                      var t = r.index + 1;
                      return (
                        (n || s.rewind) && (t = this.rewind(t)),
                        (r.index < t && t <= this.edgeIndex) || 0 === t ? t : -1
                      );
                    },
                  };
                function o() {
                  return !1 !== s.focus;
                }
                return a;
              }
              function Z(r, s) {
                var i,
                  e,
                  o,
                  n = r.options.direction === it,
                  a = r.is(I),
                  l = r.options.direction === nt,
                  c = !1,
                  u = l ? 1 : -1,
                  d = {
                    sign: u,
                    mount: function() {
                      (e = s.Elements), (i = s.Layout), (o = e.list);
                    },
                    mounted: function() {
                      var t = this;
                      a ||
                        (this.jump(0),
                        r.on("mounted resize updated", function() {
                          t.jump(r.index);
                        }));
                    },
                    go: function(t, e, n) {
                      var i = h(t),
                        o = r.index;
                      (r.State.is(U) && c) ||
                        ((c = t !== e),
                        n || r.emit("move", e, o, t),
                        1 <= Math.abs(i - this.position) || a
                          ? s.Transition.start(
                              t,
                              e,
                              o,
                              this.toCoord(i),
                              function() {
                                f(t, e, o, n);
                              }
                            )
                          : t !== o && "move" === r.options.trimSpace
                          ? s.Controller.go(t + t - o, n)
                          : f(t, e, o, n));
                    },
                    jump: function(t) {
                      this.translate(h(t));
                    },
                    translate: function(t) {
                      T(o, {
                        transform:
                          "translate" + (n ? "Y" : "X") + "(" + t + "px)",
                      });
                    },
                    cancel: function() {
                      r.is(W) ? this.shift() : this.translate(this.position),
                        T(o, { transition: "" });
                    },
                    shift: function() {
                      var t = st(this.position),
                        e = st(this.toPosition(0)),
                        n = st(this.toPosition(r.length)),
                        i = n - e;
                      t < e ? (t += i) : n < t && (t -= i),
                        this.translate(u * t);
                    },
                    trim: function(t) {
                      return !r.options.trimSpace || r.is(W)
                        ? t
                        : y(t, u * (i.totalSize() - i.size - i.gap), 0);
                    },
                    toIndex: function(i) {
                      var o = this,
                        r = 0,
                        s = 1 / 0;
                      return (
                        e.getSlides(!0).forEach(function(t) {
                          var e = t.index,
                            n = st(o.toPosition(e) - i);
                          n < s && ((s = n), (r = e));
                        }),
                        r
                      );
                    },
                    toCoord: function(t) {
                      return { x: n ? 0 : t, y: n ? t : 0 };
                    },
                    toPosition: function(t) {
                      var e = i.totalSize(t) - i.slideSize(t) - i.gap;
                      return u * (e + this.offset(t));
                    },
                    offset: function(t) {
                      var e = r.options.focus,
                        n = i.slideSize(t);
                      return "center" === e
                        ? -(i.size - n) / 2
                        : -(parseInt(e) || 0) * (n + i.gap);
                    },
                    get position() {
                      var t = n ? "top" : l ? "right" : "left";
                      return C(o)[t] - (C(e.track)[t] - i.padding[t] * u);
                    },
                  };
                function f(t, e, n, i) {
                  T(o, { transition: "" }),
                    (c = !1),
                    a || d.jump(e),
                    i || r.emit("moved", e, n, t);
                }
                function h(t) {
                  return d.trim(d.toPosition(t));
                }
                return d;
              }
              function tt(o, t) {
                var a = [],
                  e = 0,
                  l = t.Elements,
                  n = {
                    mount: function() {
                      var t = this;
                      o.is(W) &&
                        (i(),
                        o.on("refresh", i).on("resize", function() {
                          e !== r() && (t.destroy(), o.refresh());
                        }));
                    },
                    destroy: function() {
                      P(a), (a = []);
                    },
                    get clones() {
                      return a;
                    },
                    get length() {
                      return a.length;
                    },
                  };
                function i() {
                  n.destroy(),
                    (function(i) {
                      var o = l.length,
                        r = l.register;
                      if (o) {
                        for (var s = l.slides; s.length < i; ) s = s.concat(s);
                        s.slice(0, i).forEach(function(t, e) {
                          var n = c(t);
                          k(l.list, n), a.push(n), r(n, e + o, e % o);
                        }),
                          s.slice(-i).forEach(function(t, e) {
                            var n = c(t);
                            S(n, s[0]),
                              a.push(n),
                              r(n, e - i, (o + e - (i % o)) % o);
                          });
                      }
                    })((e = r()));
                }
                function r() {
                  var t = o.options;
                  if (t.clones) return t.clones;
                  var e = t.autoWidth || t.autoHeight ? l.length : t.perPage,
                    n = t.direction === it ? "Height" : "Width",
                    i = E(o.root, t["fixed" + n]);
                  return (
                    i && (e = Math.ceil(l.track["client" + n] / i)),
                    e * (t.drag ? t.flickMaxPages + 1 : 1)
                  );
                }
                function c(t) {
                  var e = t.cloneNode(!0);
                  return x(e, o.classes.clone), R(e, "id"), e;
                }
                return n;
              }
              var et = (function() {
                  function t(t, e, n) {
                    function i(t) {
                      t.elm &&
                        t.elm.removeEventListener(
                          t.event,
                          t.handler,
                          t.options
                        );
                    }
                    var o, r;
                    void 0 === e && (e = {}),
                      void 0 === n && (n = {}),
                      (this.root =
                        t instanceof Element ? t : document.querySelector(t)),
                      D(this.root, "An invalid element/selector was given."),
                      (this.Components = null),
                      (this.Event =
                        ((o = []),
                        {
                          on: function(t, e, n, i) {
                            void 0 === n && (n = null),
                              void 0 === i && (i = {}),
                              t.split(" ").forEach(function(t) {
                                n && n.addEventListener(t, e, i),
                                  o.push({
                                    event: t,
                                    handler: e,
                                    elm: n,
                                    options: i,
                                  });
                              });
                          },
                          off: function(t, n) {
                            void 0 === n && (n = null),
                              t.split(" ").forEach(function(e) {
                                o = o.filter(function(t) {
                                  return (
                                    !t ||
                                    t.event !== e ||
                                    t.elm !== n ||
                                    (i(t), !1)
                                  );
                                });
                              });
                          },
                          emit: function(e) {
                            for (
                              var t = arguments.length,
                                n = new Array(1 < t ? t - 1 : 0),
                                i = 1;
                              i < t;
                              i++
                            )
                              n[i - 1] = arguments[i];
                            o.forEach(function(t) {
                              t.elm ||
                                t.event.split(".")[0] !== e ||
                                t.handler.apply(t, n);
                            });
                          },
                          destroy: function() {
                            o.forEach(i), (o = []);
                          },
                        })),
                      (this.State =
                        ((r = z),
                        {
                          set: function(t) {
                            r = t;
                          },
                          is: function(t) {
                            return t === r;
                          },
                        })),
                      (this.STATES = s),
                      (this._o = l(q, e)),
                      (this._i = 0),
                      (this._c = n),
                      (this._e = {}),
                      (this._t = null);
                  }
                  var e,
                    n,
                    i,
                    o = t.prototype;
                  return (
                    (o.mount = function(t, e) {
                      var n,
                        i,
                        o,
                        r,
                        s = this;
                      void 0 === t && (t = this._e),
                        void 0 === e && (e = this._t),
                        this.State.set(z),
                        (this._e = t),
                        (this._t = e),
                        (this.Components =
                          ((i = l((n = this)._c, t)),
                          (o = e),
                          (r = {}),
                          g(i, function(t, e) {
                            r[e] = t(n, r, e.toLowerCase());
                          }),
                          (o = o || (n.is(I) ? A : p)),
                          (r.Transition = o(n, r)),
                          r));
                      try {
                        g(this.Components, function(t, e) {
                          var n = t.required;
                          void 0 === n || n
                            ? t.mount && t.mount()
                            : delete s.Components[e];
                        });
                      } catch (t) {
                        return void H(t.message);
                      }
                      var a = this.State;
                      return (
                        a.set(V),
                        g(this.Components, function(t) {
                          t.mounted && t.mounted();
                        }),
                        this.emit("mounted"),
                        a.set(F),
                        this.emit("ready"),
                        T(this.root, { visibility: "visible" }),
                        this.on("move drag", function() {
                          return a.set(U);
                        }).on("moved dragged", function() {
                          return a.set(F);
                        }),
                        this
                      );
                    }),
                    (o.sync = function(t) {
                      return (this.sibling = t), this;
                    }),
                    (o.on = function(t, e, n, i) {
                      return (
                        void 0 === n && (n = null),
                        void 0 === i && (i = {}),
                        this.Event.on(t, e, n, i),
                        this
                      );
                    }),
                    (o.off = function(t, e) {
                      return (
                        void 0 === e && (e = null), this.Event.off(t, e), this
                      );
                    }),
                    (o.emit = function(t) {
                      for (
                        var e,
                          n = arguments.length,
                          i = new Array(1 < n ? n - 1 : 0),
                          o = 1;
                        o < n;
                        o++
                      )
                        i[o - 1] = arguments[o];
                      return (
                        (e = this.Event).emit.apply(e, [t].concat(i)), this
                      );
                    }),
                    (o.go = function(t, e) {
                      return (
                        void 0 === e && (e = this.options.waitForTransition),
                        (this.State.is(F) || (this.State.is(U) && !e)) &&
                          this.Components.Controller.go(t, !1),
                        this
                      );
                    }),
                    (o.is = function(t) {
                      return t === this._o.type;
                    }),
                    (o.add = function(t, e) {
                      return (
                        void 0 === e && (e = -1),
                        this.Components.Elements.add(
                          t,
                          e,
                          this.refresh.bind(this)
                        ),
                        this
                      );
                    }),
                    (o.remove = function(t) {
                      return (
                        this.Components.Elements.remove(t), this.refresh(), this
                      );
                    }),
                    (o.refresh = function() {
                      return this.emit("refresh").emit("resize"), this;
                    }),
                    (o.destroy = function(e) {
                      var t = this;
                      if ((void 0 === e && (e = !0), !this.State.is(z)))
                        return (
                          v(this.Components)
                            .reverse()
                            .forEach(function(t) {
                              t.destroy && t.destroy(e);
                            }),
                          this.emit("destroy", e),
                          this.Event.destroy(),
                          this.State.set(G),
                          this
                        );
                      this.on("ready", function() {
                        return t.destroy(e);
                      });
                    }),
                    (e = t),
                    (n = [
                      {
                        key: "index",
                        get: function() {
                          return this._i;
                        },
                        set: function(t) {
                          this._i = parseInt(t);
                        },
                      },
                      {
                        key: "length",
                        get: function() {
                          return this.Components.Elements.length;
                        },
                      },
                      {
                        key: "options",
                        get: function() {
                          return this._o;
                        },
                        set: function(t) {
                          var e = this.State.is(z);
                          e || this.emit("update"),
                            (this._o = l(this._o, t)),
                            e || this.emit("updated", this._o);
                        },
                      },
                      {
                        key: "classes",
                        get: function() {
                          return this._o.classes;
                        },
                      },
                      {
                        key: "i18n",
                        get: function() {
                          return this._o.i18n;
                        },
                      },
                    ]) && K(e.prototype, n),
                    i && K(e, i),
                    t
                  );
                })(),
                nt = "rtl",
                it = "ttb",
                ot = "update.slide",
                rt = Math.floor,
                st = Math.abs;
              function at(t, e) {
                var n;
                return function() {
                  n =
                    n ||
                    setTimeout(function() {
                      t(), (n = null);
                    }, e);
                };
              }
              function lt(e, n, i) {
                function o(t) {
                  c ||
                    (r || ((r = t), a && a < 1 && (r -= a * n)),
                    (a = (s = t - r) / n),
                    n <= s && ((r = 0), (a = 1), e()),
                    i && i(a),
                    l(o));
                }
                var r,
                  s,
                  a,
                  l = window.requestAnimationFrame,
                  c = !0;
                return {
                  pause: function() {
                    (c = !0), (r = 0);
                  },
                  play: function(t) {
                    (r = 0), c && ((c = !1), t && (a = 0), l(o));
                  },
                };
              }
              function ct(t, e) {
                var n,
                  i,
                  r,
                  o,
                  s,
                  a,
                  l,
                  c,
                  u,
                  d,
                  f,
                  h,
                  p = e.Elements,
                  v = t.options.direction === it,
                  m =
                    ((n = {
                      mount: function() {
                        t
                          .on(
                            "resize load",
                            at(function() {
                              t.emit("resize");
                            }, t.options.throttle),
                            window
                          )
                          .on("resize", y)
                          .on("updated refresh", g),
                          g(),
                          (this.totalSize = v
                            ? this.totalHeight
                            : this.totalWidth),
                          (this.slideSize = v
                            ? this.slideHeight
                            : this.slideWidth);
                      },
                      destroy: function() {
                        R([p.list, p.track], "style");
                      },
                      get size() {
                        return v ? this.height : this.width;
                      },
                    }),
                    (i = v
                      ? ((c = t),
                        (f = e.Elements),
                        (h = c.root),
                        {
                          margin: "marginBottom",
                          init: function() {
                            this.resize();
                          },
                          resize: function() {
                            (d = c.options),
                              (u = f.track),
                              (this.gap = E(h, d.gap));
                            var t = d.padding,
                              e = E(h, t.top || t),
                              n = E(h, t.bottom || t);
                            (this.padding = { top: e, bottom: n }),
                              T(u, { paddingTop: w(e), paddingBottom: w(n) });
                          },
                          totalHeight: function(t) {
                            void 0 === t && (t = c.length - 1);
                            var e = f.getSlide(t);
                            return e
                              ? C(e.slide).bottom - C(f.list).top + this.gap
                              : 0;
                          },
                          slideWidth: function() {
                            return E(h, d.fixedWidth || this.width);
                          },
                          slideHeight: function(t) {
                            if (d.autoHeight) {
                              var e = f.getSlide(t);
                              return e ? e.slide.offsetHeight : 0;
                            }
                            var n =
                              d.fixedHeight ||
                              (this.height + this.gap) / d.perPage - this.gap;
                            return E(h, n);
                          },
                          get width() {
                            return u.clientWidth;
                          },
                          get height() {
                            var t = d.height || this.width * d.heightRatio;
                            return (
                              D(t, '"height" or "heightRatio" is missing.'),
                              E(h, t) - this.padding.top - this.padding.bottom
                            );
                          },
                        })
                      : ((r = t),
                        (s = e.Elements),
                        (a = r.root),
                        {
                          margin:
                            "margin" +
                            ((l = r.options).direction === nt
                              ? "Left"
                              : "Right"),
                          height: 0,
                          init: function() {
                            this.resize();
                          },
                          resize: function() {
                            (l = r.options),
                              (o = s.track),
                              (this.gap = E(a, l.gap));
                            var t = l.padding,
                              e = E(a, t.left || t),
                              n = E(a, t.right || t);
                            (this.padding = { left: e, right: n }),
                              T(o, { paddingLeft: w(e), paddingRight: w(n) });
                          },
                          totalWidth: function(t) {
                            void 0 === t && (t = r.length - 1);
                            var e,
                              n,
                              i = s.getSlide(t),
                              o = 0;
                            return (
                              i &&
                                ((e = C(i.slide)),
                                (n = C(s.list)),
                                (o =
                                  l.direction === nt
                                    ? n.right - e.left
                                    : e.right - n.left),
                                (o += this.gap)),
                              o
                            );
                          },
                          slideWidth: function(t) {
                            if (l.autoWidth) {
                              var e = s.getSlide(t);
                              return e ? e.slide.offsetWidth : 0;
                            }
                            var n =
                              l.fixedWidth ||
                              (this.width + this.gap) / l.perPage - this.gap;
                            return E(a, n);
                          },
                          slideHeight: function() {
                            var t =
                              l.height ||
                              l.fixedHeight ||
                              this.width * l.heightRatio;
                            return E(a, t);
                          },
                          get width() {
                            return (
                              o.clientWidth -
                              this.padding.left -
                              this.padding.right
                            );
                          },
                        })),
                    b(i).forEach(function(t) {
                      n[t] ||
                        Object.defineProperty(
                          n,
                          t,
                          Object.getOwnPropertyDescriptor(i, t)
                        );
                    }),
                    n);
                function g() {
                  m.init(),
                    T(t.root, { maxWidth: w(t.options.width) }),
                    p.each(function(t) {
                      t.slide.style[m.margin] = w(m.gap);
                    }),
                    y();
                }
                function y() {
                  var e = t.options;
                  m.resize(), T(p.track, { height: w(m.height) });
                  var n = e.autoHeight ? null : w(m.slideHeight());
                  p.each(function(t) {
                    T(t.container, { height: n }),
                      T(t.slide, {
                        width: e.autoWidth ? null : w(m.slideWidth(t.index)),
                        height: t.container ? null : n,
                      });
                  });
                }
                return m;
              }
              function ut(l, c) {
                var n,
                  i,
                  o,
                  r,
                  u = c.Track,
                  d = c.Controller,
                  s = l.options.direction === it,
                  f = s ? "y" : "x",
                  e = {
                    disabled: !1,
                    mount: function() {
                      var t = this,
                        e = c.Elements,
                        n = e.track;
                      l.on("touchstart mousedown", a, n)
                        .on("touchmove mousemove", p, n, { passive: !1 })
                        .on(
                          "touchend touchcancel mouseleave mouseup dragend",
                          v,
                          n
                        )
                        .on("mounted refresh", function() {
                          g(e.list.querySelectorAll("img, a"), function(t) {
                            l.off("dragstart", t).on(
                              "dragstart",
                              function(t) {
                                t.preventDefault();
                              },
                              t,
                              { passive: !1 }
                            );
                          });
                        })
                        .on("mounted updated", function() {
                          t.disabled = !l.options.drag;
                        });
                    },
                  };
                function a(t) {
                  e.disabled || r || h(t);
                }
                function h(t) {
                  (n = u.toCoord(u.position)), (i = m(t, {})), (o = i);
                }
                function p(t) {
                  var e;
                  i &&
                    ((o = m(t, i)),
                    r
                      ? (t.cancelable && t.preventDefault(),
                        l.is(I) ||
                          ((e = n[f] + o.offset[f]),
                          u.translate(
                            (function(t) {
                              {
                                var e, n, i;
                                l.is(Y) &&
                                  ((e = u.sign),
                                  (n = e * u.trim(u.toPosition(0))),
                                  (i = e * u.trim(u.toPosition(d.edgeIndex))),
                                  (t *= e) < n
                                    ? (t = n - 7 * Math.log(n - t))
                                    : i < t && (t = i + 7 * Math.log(t - i)),
                                  (t *= e));
                              }
                              return t;
                            })(e)
                          )))
                      : (function(t) {
                          var e = t.offset;
                          if (l.State.is(U) && l.options.waitForTransition)
                            return !1;
                          var n =
                            (180 * Math.atan(vt(e.y) / vt(e.x))) / Math.PI;
                          s && (n = 90 - n);
                          return n < l.options.dragAngleThreshold;
                        })(o) &&
                        (l.emit("drag", i), (r = !0), u.cancel(), h(t)));
                }
                function v() {
                  (i = null),
                    r &&
                      (l.emit("dragged", o),
                      (function(t) {
                        var e = t.velocity[f],
                          n = vt(e);
                        {
                          var i, o, r, s, a;
                          0 < n &&
                            ((i = l.options),
                            (o = l.index),
                            (r = e < 0 ? -1 : 1),
                            (s = o),
                            l.is(I) ||
                              ((a = u.position),
                              n > i.flickVelocityThreshold &&
                                vt(t.offset[f]) < i.swipeDistanceThreshold &&
                                (a +=
                                  r *
                                  Math.min(
                                    n * i.flickPower,
                                    c.Layout.size * (i.flickMaxPages || 1)
                                  )),
                              (s = u.toIndex(a))),
                            s === o && 0.1 < n && (s = o + r * u.sign),
                            l.is(Y) && (s = y(s, 0, d.edgeIndex)),
                            d.go(s, i.isNavigation));
                        }
                      })(o),
                      (r = !1));
                }
                function m(t, e) {
                  var n = t.timeStamp,
                    i = t.touches,
                    o = i ? i[0] : t,
                    r = o.clientX,
                    s = o.clientY,
                    a = e.to || {},
                    l = a.x,
                    c = a.y,
                    u = {
                      x: r - (void 0 === l ? r : l),
                      y: s - (void 0 === c ? s : c),
                    },
                    d = n - (e.time || 0);
                  return {
                    to: { x: r, y: s },
                    offset: u,
                    time: n,
                    velocity: { x: u.x / d, y: u.y / d },
                  };
                }
                return e;
              }
              function dt(t, e) {
                var n = !1;
                function i(t) {
                  n &&
                    (t.preventDefault(),
                    t.stopPropagation(),
                    t.stopImmediatePropagation());
                }
                return {
                  required: t.options.drag && !t.is(I),
                  mount: function() {
                    t.on("click", i, e.Elements.track, { capture: !0 })
                      .on("drag", function() {
                        n = !0;
                      })
                      .on("moved", function() {
                        n = !1;
                      });
                  },
                };
              }
              function ft(o, r, s) {
                var a,
                  l,
                  t,
                  i = o.classes,
                  c = o.root,
                  u = r.Elements;
                function e() {
                  var t = r.Controller,
                    e = t.prevIndex,
                    n = t.nextIndex,
                    i = o.length > o.options.perPage || o.is(W);
                  (a.disabled = e < 0 || !i),
                    (l.disabled = n < 0 || !i),
                    o.emit(s + ":updated", a, l, e, n);
                }
                function n(t) {
                  return d(
                    '<button class="' +
                      i.arrow +
                      " " +
                      (t ? i.prev : i.next) +
                      '" type="button"><svg xmlns="http://www.w3.org/2000/svg"\tviewBox="0 0 40 40"\twidth="40"\theight="40"><path d="' +
                      (o.options.arrowPath ||
                        "m15.5 0.932-4.3 4.38 14.5 14.6-14.5 14.5 4.3 4.4 14.6-14.6 4.4-4.3-4.4-4.4-14.6-14.6z") +
                      '" />'
                  );
                }
                return {
                  required: o.options.arrows,
                  mount: function() {
                    (a = u.arrows.prev),
                      (l = u.arrows.next),
                      (a && l) ||
                        !o.options.arrows ||
                        ((a = n(!0)),
                        (l = n(!1)),
                        (t = !0),
                        (function() {
                          var t = f("div", { class: i.arrows });
                          k(t, a), k(t, l);
                          var e = u.slider,
                            n = "slider" === o.options.arrows && e ? e : c;
                          S(t, n.firstElementChild);
                        })()),
                      a &&
                        l &&
                        o
                          .on(
                            "click",
                            function() {
                              o.go("<");
                            },
                            a
                          )
                          .on(
                            "click",
                            function() {
                              o.go(">");
                            },
                            l
                          )
                          .on("mounted move updated refresh", e),
                      (this.arrows = { prev: a, next: l });
                  },
                  mounted: function() {
                    o.emit(s + ":mounted", a, l);
                  },
                  destroy: function() {
                    R([a, l], "disabled"), t && P(a.parentElement);
                  },
                };
              }
              function ht(s, e, r) {
                var a = {},
                  l = e.Elements,
                  c = {
                    mount: function() {
                      var t,
                        e,
                        o,
                        r,
                        n,
                        i = s.options.pagination;
                      i &&
                        ((e = s.options),
                        (o = s.classes),
                        (r = f("ul", { class: o.pagination })),
                        (n = l
                          .getSlides(!1)
                          .filter(function(t) {
                            return !1 !== e.focus || t.index % e.perPage == 0;
                          })
                          .map(function(t, e) {
                            var n = f("li", {}),
                              i = f("button", {
                                class: o.page,
                                type: "button",
                              });
                            return (
                              k(n, i),
                              k(r, n),
                              s.on(
                                "click",
                                function() {
                                  s.go(">" + e);
                                },
                                i
                              ),
                              {
                                li: n,
                                button: i,
                                page: e,
                                Slides: l.getSlidesByPage(e),
                              }
                            );
                          })),
                        (a = { list: r, items: n }),
                        (t = l.slider),
                        k("slider" === i && t ? t : s.root, a.list),
                        s.on(bt, u)),
                        s.off(wt).on(wt, function() {
                          c.destroy(),
                            s.options.pagination && (c.mount(), c.mounted());
                        });
                    },
                    mounted: function() {
                      var t;
                      s.options.pagination &&
                        ((t = s.index),
                        s.emit(r + ":mounted", a, this.getItem(t)),
                        u(t, -1));
                    },
                    destroy: function() {
                      P(a.list),
                        a.items &&
                          a.items.forEach(function(t) {
                            s.off("click", t.button);
                          }),
                        s.off(bt),
                        (a = {});
                    },
                    getItem: function(t) {
                      return a.items[e.Controller.toPage(t)];
                    },
                    get data() {
                      return a;
                    },
                  };
                function u(t, e) {
                  var n = c.getItem(e),
                    i = c.getItem(t),
                    o = B.active;
                  n && O(n.button, o),
                    i && x(i.button, o),
                    s.emit(r + ":updated", a, n, i);
                }
                return c;
              }
              function pt(a, n) {
                var l = a.i18n,
                  i = n.Elements,
                  o = [Tt, xt, kt, St, Pt, "role"];
                function e(t, e) {
                  j(t, Tt, !e), a.options.slideFocus && j(t, xt, e ? 0 : -1);
                }
                function t(t, e) {
                  var n = i.track.id;
                  j(t, kt, n), j(e, kt, n);
                }
                function r(t, e, n, i) {
                  var o = a.index,
                    r = -1 < n && o < n ? l.last : l.prev,
                    s = -1 < i && i < o ? l.first : l.next;
                  j(t, St, r), j(e, St, s);
                }
                function s(t, e) {
                  e && j(e.button, Pt, !0),
                    t.items.forEach(function(t) {
                      var e = a.options,
                        n = h(
                          !1 === e.focus && 1 < e.perPage ? l.pageX : l.slideX,
                          t.page + 1
                        ),
                        i = t.button,
                        o = t.Slides.map(function(t) {
                          return t.slide.id;
                        });
                      j(i, kt, o.join(" ")), j(i, St, n);
                    });
                }
                function c(t, e, n) {
                  e && R(e.button, Pt), n && j(n.button, Pt, !0);
                }
                function u(s) {
                  i.each(function(t) {
                    var e = t.slide,
                      n = t.realIndex;
                    f(e) || j(e, "role", "button");
                    var i = -1 < n ? n : t.index,
                      o = h(l.slideX, i + 1),
                      r = s.Components.Elements.getSlide(i);
                    j(e, St, o), r && j(e, kt, r.slide.id);
                  });
                }
                function d(t, e) {
                  var n = t.slide;
                  e ? j(n, Pt, !0) : R(n, Pt);
                }
                function f(t) {
                  return "BUTTON" === t.tagName;
                }
                return {
                  required: a.options.accessibility,
                  mount: function() {
                    a
                      .on("visible", function(t) {
                        e(t.slide, !0);
                      })
                      .on("hidden", function(t) {
                        e(t.slide, !1);
                      })
                      .on("arrows:mounted", t)
                      .on("arrows:updated", r)
                      .on("pagination:mounted", s)
                      .on("pagination:updated", c)
                      .on("refresh", function() {
                        R(n.Clones.clones, o);
                      }),
                      a.options.isNavigation &&
                        a
                          .on("navigation:mounted", u)
                          .on("active", function(t) {
                            d(t, !0);
                          })
                          .on("inactive", function(t) {
                            d(t, !1);
                          }),
                      ["play", "pause"].forEach(function(t) {
                        var e = i[t];
                        e &&
                          (f(e) || j(e, "role", "button"),
                          j(e, kt, i.track.id),
                          j(e, St, l[t]));
                      });
                  },
                  destroy: function() {
                    var t = n.Arrows,
                      e = t ? t.arrows : {};
                    R(i.slides.concat([e.prev, e.next, i.play, i.pause]), o);
                  },
                };
              }
              var vt = Math.abs,
                mt = 1,
                gt = 2,
                yt = 3,
                bt = "move.page",
                wt = "updated.page refresh.page",
                Et = "data-splide-lazy",
                _t = "data-splide-lazy-srcset",
                Pt = "aria-current",
                kt = "aria-controls",
                St = "aria-label",
                Tt = "aria-hidden",
                xt = "tabindex",
                Ot = {
                  ltr: {
                    ArrowLeft: "<",
                    ArrowRight: ">",
                    Left: "<",
                    Right: ">",
                  },
                  rtl: {
                    ArrowLeft: ">",
                    ArrowRight: "<",
                    Left: ">",
                    Right: "<",
                  },
                  ttb: { ArrowUp: "<", ArrowDown: ">", Up: "<", Down: ">" },
                },
                Lt = "move.sync",
                jt = [" ", "Enter", "Spacebar"],
                Mt = {
                  Options: $,
                  Breakpoints: function(r) {
                    var s,
                      a,
                      l = r.options.breakpoints,
                      e = at(t, 50),
                      c = [];
                    function t() {
                      var t,
                        e,
                        n,
                        i,
                        o = (t = c.filter(function(t) {
                          return t.mql.matches;
                        })[0])
                          ? t.point
                          : -1;
                      o !== a &&
                        ((a = o),
                        (e = r.State),
                        (i = (n = l[o] || s).destroy)
                          ? ((r.options = s), r.destroy("completely" === i))
                          : (e.is(G) && (e.set(z), r.mount()),
                            (r.options = n)));
                    }
                    return {
                      required: l && matchMedia,
                      mount: function() {
                        (c = Object.keys(l)
                          .sort(function(t, e) {
                            return t - e;
                          })
                          .map(function(t) {
                            return {
                              point: t,
                              mql: matchMedia("(max-width:" + t + "px)"),
                            };
                          })),
                          this.destroy(!0),
                          addEventListener("resize", e),
                          (s = r.options),
                          t();
                      },
                      destroy: function(t) {
                        t && removeEventListener("resize", e);
                      },
                    };
                  },
                  Controller: Q,
                  Elements: J,
                  Track: Z,
                  Clones: tt,
                  Layout: ct,
                  Drag: ut,
                  Click: dt,
                  Autoplay: function(o, t, n) {
                    var i,
                      r = [],
                      s = t.Elements,
                      a = {
                        required: o.options.autoplay,
                        mount: function() {
                          var t = o.options;
                          s.slides.length > t.perPage &&
                            ((i = lt(
                              function() {
                                o.go(">");
                              },
                              t.interval,
                              function(t) {
                                o.emit(n + ":playing", t),
                                  s.bar && T(s.bar, { width: 100 * t + "%" });
                              }
                            )),
                            (function() {
                              var t = o.options,
                                e = o.sibling,
                                n = [o.root, e ? e.root : null];
                              t.pauseOnHover &&
                                (l(n, "mouseleave", mt, !0),
                                l(n, "mouseenter", mt, !1));
                              t.pauseOnFocus &&
                                (l(n, "focusout", gt, !0),
                                l(n, "focusin", gt, !1));
                              s.play &&
                                o.on(
                                  "click",
                                  function() {
                                    a.play(gt), a.play(yt);
                                  },
                                  s.play
                                );
                              s.pause && l([s.pause], "click", yt, !1);
                              o.on("move refresh", function() {
                                a.play();
                              }).on("destroy", function() {
                                a.pause();
                              });
                            })(),
                            this.play());
                        },
                        play: function(e) {
                          void 0 === e && (e = 0),
                            (r = r.filter(function(t) {
                              return t !== e;
                            })).length ||
                              (o.emit(n + ":play"),
                              i.play(o.options.resetProgress));
                        },
                        pause: function(t) {
                          void 0 === t && (t = 0),
                            i.pause(),
                            -1 === r.indexOf(t) && r.push(t),
                            1 === r.length && o.emit(n + ":pause");
                        },
                      };
                    function l(t, e, n, i) {
                      t.forEach(function(t) {
                        o.on(
                          e,
                          function() {
                            a[i ? "play" : "pause"](n);
                          },
                          t
                        );
                      });
                    }
                    return a;
                  },
                  Cover: function(t, e) {
                    function n(n) {
                      e.Elements.each(function(t) {
                        var e = _(t.slide, "IMG") || _(t.container, "IMG");
                        e && e.src && i(e, n);
                      });
                    }
                    function i(t, e) {
                      T(t.parentElement, {
                        background: e
                          ? ""
                          : 'center/cover no-repeat url("' + t.src + '")',
                      }),
                        T(t, { display: e ? "" : "none" });
                    }
                    return {
                      required: t.options.cover,
                      mount: function() {
                        t.on("lazyload:loaded", function(t) {
                          i(t, !1);
                        }),
                          t.on("mounted updated refresh", function() {
                            return n(!1);
                          });
                      },
                      destroy: function() {
                        n(!0);
                      },
                    };
                  },
                  Arrows: ft,
                  Pagination: ht,
                  LazyLoad: function(o, t, r) {
                    var e,
                      n,
                      i = o.options,
                      s = "sequential" === i.lazyLoad;
                    function a() {
                      (n = []), (e = 0);
                    }
                    function l(e) {
                      (e = isNaN(e) ? o.index : e),
                        (n = n.filter(function(t) {
                          return (
                            !t.Slide.isWithin(
                              e,
                              i.perPage * (i.preloadPages + 1)
                            ) || (c(t.img, t.Slide), !1)
                          );
                        }))[0] || o.off("moved." + r);
                    }
                    function c(t, e) {
                      x(e.slide, B.loading);
                      var n = f("span", { class: o.classes.spinner });
                      k(t.parentElement, n),
                        (t.onload = function() {
                          d(t, n, e, !1);
                        }),
                        (t.onerror = function() {
                          d(t, n, e, !0);
                        }),
                        j(t, "srcset", M(t, _t) || ""),
                        j(t, "src", M(t, Et) || "");
                    }
                    function u() {
                      var t;
                      e < n.length && c((t = n[e]).img, t.Slide), e++;
                    }
                    function d(t, e, n, i) {
                      O(n.slide, B.loading),
                        i ||
                          (P(e),
                          T(t, { display: "" }),
                          o.emit(r + ":loaded", t).emit("resize")),
                        s && u();
                    }
                    return {
                      required: i.lazyLoad,
                      mount: function() {
                        o.on("mounted refresh", function() {
                          a(),
                            t.Elements.each(function(e) {
                              g(
                                e.slide.querySelectorAll(
                                  "[" + Et + "], [" + _t + "]"
                                ),
                                function(t) {
                                  t.src ||
                                    t.srcset ||
                                    (n.push({ img: t, Slide: e }),
                                    T(t, { display: "none" }));
                                }
                              );
                            }),
                            s && u();
                        }),
                          s || o.on("mounted refresh moved." + r, l);
                      },
                      destroy: a,
                    };
                  },
                  Keyboard: function(o) {
                    var r;
                    return {
                      mount: function() {
                        o.on("mounted updated", function() {
                          var t = o.options,
                            e = o.root,
                            n = Ot[t.direction],
                            i = t.keyboard;
                          r && (o.off("keydown", r), R(e, xt)),
                            i &&
                              ("focused" === i
                                ? j((r = e), xt, 0)
                                : (r = document),
                              o.on(
                                "keydown",
                                function(t) {
                                  n[t.key] && o.go(n[t.key]);
                                },
                                r
                              ));
                        });
                      },
                    };
                  },
                  Sync: function(i) {
                    var o = i.sibling,
                      t = o && o.options.isNavigation;
                    function r() {
                      i.on(Lt, function(t, e, n) {
                        o.off(Lt).go(o.is(W) ? n : t, !1), s();
                      });
                    }
                    function s() {
                      o.on(Lt, function(t, e, n) {
                        i.off(Lt).go(i.is(W) ? n : t, !1), r();
                      });
                    }
                    function a(t) {
                      i.State.is(F) && o.go(t);
                    }
                    return {
                      required: !!o,
                      mount: function() {
                        r(),
                          s(),
                          t &&
                            o.Components.Elements.each(function(t) {
                              var e = t.slide,
                                n = t.index;
                              i.on(
                                "mouseup touchend",
                                function(t) {
                                  (t.button && 0 !== t.button) || a(n);
                                },
                                e
                              ),
                                i.on(
                                  "keyup",
                                  function(t) {
                                    -1 < jt.indexOf(t.key) &&
                                      (t.preventDefault(), a(n));
                                  },
                                  e,
                                  { passive: !1 }
                                );
                            });
                      },
                      mounted: function() {
                        t && o.emit("navigation:mounted", i);
                      },
                    };
                  },
                  A11y: pt,
                };
              var Rt = (function(n) {
                var t, e;
                function i(t, e) {
                  return n.call(this, t, e, Mt) || this;
                }
                return (
                  (e = n),
                  ((t = i).prototype = Object.create(e.prototype)),
                  ((t.prototype.constructor = t).__proto__ = e),
                  i
                );
              })(et);
            },
          ]),
          (o.c = i),
          (o.d = function(t, e, n) {
            o.o(t, e) ||
              Object.defineProperty(t, e, { enumerable: !0, get: n });
          }),
          (o.r = function(t) {
            "undefined" != typeof Symbol &&
              Symbol.toStringTag &&
              Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
              Object.defineProperty(t, "__esModule", { value: !0 });
          }),
          (o.t = function(e, t) {
            if ((1 & t && (e = o(e)), 8 & t)) return e;
            if (4 & t && "object" == typeof e && e && e.__esModule) return e;
            var n = Object.create(null);
            if (
              (o.r(n),
              Object.defineProperty(n, "default", { enumerable: !0, value: e }),
              2 & t && "string" != typeof e)
            )
              for (var i in e)
                o.d(
                  n,
                  i,
                  function(t) {
                    return e[t];
                  }.bind(null, i)
                );
            return n;
          }),
          (o.n = function(t) {
            var e =
              t && t.__esModule
                ? function() {
                    return t.default;
                  }
                : function() {
                    return t;
                  };
            return o.d(e, "a", e), e;
          }),
          (o.o = function(t, e) {
            return Object.prototype.hasOwnProperty.call(t, e);
          }),
          (o.p = ""),
          o((o.s = 0))
        );
        function o(t) {
          if (i[t]) return i[t].exports;
          var e = (i[t] = { i: t, l: !1, exports: {} });
          return n[t].call(e.exports, e, e.exports, o), (e.l = !0), e.exports;
        }
        var n, i;
      }),
      (t.exports = i());
  },
  function(t, e, n) {
    var i;
    window,
      (i = function() {
        return (
          (i = {}),
          (o.m = n = [
            function(t, e) {
              var n = (function() {
                return this;
              })();
              try {
                n = n || new Function("return this")();
              } catch (t) {
                "object" == typeof window && (n = window);
              }
              t.exports = n;
            },
            function(t, C, e) {
              "use strict";
              (function(t, b) {
                function i(t, e) {
                  for (var n = 0; n < e.length; n++) {
                    var i = e[n];
                    (i.enumerable = i.enumerable || !1),
                      (i.configurable = !0),
                      "value" in i && (i.writable = !0),
                      Object.defineProperty(t, i.key, i);
                  }
                }
                var e =
                  void 0 !== t && "[object global]" === {}.toString.call(t);
                function s(t, e) {
                  return 0 === t.indexOf(e.toLowerCase())
                    ? t
                    : ""
                        .concat(e.toLowerCase())
                        .concat(t.substr(0, 1).toUpperCase())
                        .concat(t.substr(1));
                }
                function c(t) {
                  return /^(https?:)?\/\/((player|www)\.)?vimeo\.com(?=$|\/)/.test(
                    t
                  );
                }
                function u(t) {
                  var e,
                    n = 0 < arguments.length && void 0 !== t ? t : {},
                    i = n.id,
                    o = n.url,
                    r = i || o;
                  if (!r)
                    throw new Error(
                      "An id or url must be passed, either in an options object or as a data-vimeo-id or data-vimeo-url attribute."
                    );
                  if (
                    ((e = r),
                    !isNaN(parseFloat(e)) && isFinite(e) && Math.floor(e) == e)
                  )
                    return "https://vimeo.com/".concat(r);
                  if (c(r)) return r.replace("http:", "https:");
                  if (i)
                    throw new TypeError(
                      "â€œ".concat(i, "â€ is not a valid video id.")
                    );
                  throw new TypeError(
                    "â€œ".concat(r, "â€ is not a vimeo.com url.")
                  );
                }
                var n = void 0 !== Array.prototype.indexOf,
                  o =
                    "undefined" != typeof window &&
                    void 0 !== window.postMessage;
                if (!(e || (n && o)))
                  throw new Error(
                    "Sorry, the Vimeo Player API is not available in this browser."
                  );
                var r,
                  a,
                  l,
                  d =
                    "undefined" != typeof window
                      ? window
                      : void 0 !== t
                      ? t
                      : "undefined" != typeof self
                      ? self
                      : {};
                function f() {
                  if (void 0 === this)
                    throw new TypeError("Constructor WeakMap requires 'new'");
                  if (
                    (l(this, "_id", "_WeakMap_" + p() + "." + p()),
                    0 < arguments.length)
                  )
                    throw new TypeError("WeakMap iterable is not supported");
                }
                function h(t, e) {
                  if (!v(t) || !a.call(t, "_id"))
                    throw new TypeError(
                      e + " method called on incompatible receiver " + typeof t
                    );
                }
                function p() {
                  return Math.random()
                    .toString()
                    .substring(2);
                }
                function v(t) {
                  return Object(t) === t;
                }
                /*!
                 * weakmap-polyfill v2.0.0 - ECMAScript6 WeakMap polyfill
                 * https://github.com/polygonplanet/weakmap-polyfill
                 * Copyright (c) 2015-2016 polygon planet <polygon.planet.aqua@gmail.com>
                 * @license MIT
                 */
                (r =
                  "undefined" != typeof self
                    ? self
                    : "undefined" != typeof window
                    ? window
                    : d).WeakMap ||
                  ((a = Object.prototype.hasOwnProperty),
                  (l = function(t, e, n) {
                    Object.defineProperty
                      ? Object.defineProperty(t, e, {
                          configurable: !0,
                          writable: !0,
                          value: n,
                        })
                      : (t[e] = n);
                  }),
                  (r.WeakMap =
                    (l(f.prototype, "delete", function(t) {
                      if ((h(this, "delete"), !v(t))) return !1;
                      var e = t[this._id];
                      return !(!e || e[0] !== t) && (delete t[this._id], !0);
                    }),
                    l(f.prototype, "get", function(t) {
                      if ((h(this, "get"), v(t))) {
                        var e = t[this._id];
                        return e && e[0] === t ? e[1] : void 0;
                      }
                    }),
                    l(f.prototype, "has", function(t) {
                      if ((h(this, "has"), !v(t))) return !1;
                      var e = t[this._id];
                      return !(!e || e[0] !== t);
                    }),
                    l(f.prototype, "set", function(t, e) {
                      if ((h(this, "set"), !v(t)))
                        throw new TypeError(
                          "Invalid value used as weak map key"
                        );
                      var n = t[this._id];
                      return (
                        n && n[0] === t ? (n[1] = e) : l(t, this._id, [t, e]),
                        this
                      );
                    }),
                    l(f, "_polyfill", !0),
                    f)));
                var m,
                  g =
                    ((function(t) {
                      /*! Native Promise Only
    v0.8.1 (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/
                      var e, n, i;
                      (i = function() {
                        var e,
                          n,
                          i,
                          o,
                          r,
                          s,
                          t = Object.prototype.toString,
                          a =
                            void 0 !== b
                              ? function(t) {
                                  return b(t);
                                }
                              : setTimeout;
                        try {
                          Object.defineProperty({}, "x", {}),
                            (e = function(t, e, n, i) {
                              return Object.defineProperty(t, e, {
                                value: n,
                                writable: !0,
                                configurable: !1 !== i,
                              });
                            });
                        } catch (t) {
                          e = function(t, e, n) {
                            return (t[e] = n), t;
                          };
                        }
                        function l(t, e) {
                          (this.fn = t), (this.self = e), (this.next = void 0);
                        }
                        function c(t, e) {
                          i.add(t, e), (n = n || a(i.drain));
                        }
                        function u(t) {
                          var e,
                            n = typeof t;
                          return (
                            null == t ||
                              ("object" != n && "function" != n) ||
                              (e = t.then),
                            "function" == typeof e && e
                          );
                        }
                        function d() {
                          for (var t = 0; t < this.chain.length; t++)
                            !(function(t, e, n) {
                              var i, o;
                              try {
                                !1 === e
                                  ? n.reject(t.msg)
                                  : (i =
                                      !0 === e
                                        ? t.msg
                                        : e.call(void 0, t.msg)) === n.promise
                                  ? n.reject(TypeError("Promise-chain cycle"))
                                  : (o = u(i))
                                  ? o.call(i, n.resolve, n.reject)
                                  : n.resolve(i);
                              } catch (t) {
                                n.reject(t);
                              }
                            })(
                              this,
                              1 === this.state
                                ? this.chain[t].success
                                : this.chain[t].failure,
                              this.chain[t]
                            );
                          this.chain.length = 0;
                        }
                        function f(t) {
                          var n,
                            i = this;
                          if (!i.triggered) {
                            (i.triggered = !0), i.def && (i = i.def);
                            try {
                              (n = u(t))
                                ? c(function() {
                                    var e = new v(i);
                                    try {
                                      n.call(
                                        t,
                                        function() {
                                          f.apply(e, arguments);
                                        },
                                        function() {
                                          h.apply(e, arguments);
                                        }
                                      );
                                    } catch (t) {
                                      h.call(e, t);
                                    }
                                  })
                                : ((i.msg = t),
                                  (i.state = 1),
                                  0 < i.chain.length && c(d, i));
                            } catch (t) {
                              h.call(new v(i), t);
                            }
                          }
                        }
                        function h(t) {
                          var e = this;
                          e.triggered ||
                            ((e.triggered = !0),
                            e.def && (e = e.def),
                            (e.msg = t),
                            (e.state = 2),
                            0 < e.chain.length && c(d, e));
                        }
                        function p(t, n, i, o) {
                          for (var e = 0; e < n.length; e++)
                            !(function(e) {
                              t.resolve(n[e]).then(function(t) {
                                i(e, t);
                              }, o);
                            })(e);
                        }
                        function v(t) {
                          (this.def = t), (this.triggered = !1);
                        }
                        function m(t) {
                          (this.promise = t),
                            (this.state = 0),
                            (this.triggered = !1),
                            (this.chain = []),
                            (this.msg = void 0);
                        }
                        function g(t) {
                          if ("function" != typeof t)
                            throw TypeError("Not a function");
                          if (0 !== this.__NPO__)
                            throw TypeError("Not a promise");
                          this.__NPO__ = 1;
                          var i = new m(this);
                          (this.then = function(t, e) {
                            var n = {
                              success: "function" != typeof t || t,
                              failure: "function" == typeof e && e,
                            };
                            return (
                              (n.promise = new this.constructor(function(t, e) {
                                if (
                                  "function" != typeof t ||
                                  "function" != typeof e
                                )
                                  throw TypeError("Not a function");
                                (n.resolve = t), (n.reject = e);
                              })),
                              i.chain.push(n),
                              0 !== i.state && c(d, i),
                              n.promise
                            );
                          }),
                            (this.catch = function(t) {
                              return this.then(void 0, t);
                            });
                          try {
                            t.call(
                              void 0,
                              function(t) {
                                f.call(i, t);
                              },
                              function(t) {
                                h.call(i, t);
                              }
                            );
                          } catch (t) {
                            h.call(i, t);
                          }
                        }
                        var y = e(
                          {},
                          "constructor",
                          g,
                          !(i = {
                            add: function(t, e) {
                              (s = new l(t, e)),
                                r ? (r.next = s) : (o = s),
                                (r = s),
                                (s = void 0);
                            },
                            drain: function() {
                              var t = o;
                              for (o = r = n = void 0; t; )
                                t.fn.call(t.self), (t = t.next);
                            },
                          })
                        );
                        return (
                          e((g.prototype = y), "__NPO__", 0, !1),
                          e(g, "resolve", function(n) {
                            return n && "object" == typeof n && 1 === n.__NPO__
                              ? n
                              : new this(function(t, e) {
                                  if (
                                    "function" != typeof t ||
                                    "function" != typeof e
                                  )
                                    throw TypeError("Not a function");
                                  t(n);
                                });
                          }),
                          e(g, "reject", function(n) {
                            return new this(function(t, e) {
                              if (
                                "function" != typeof t ||
                                "function" != typeof e
                              )
                                throw TypeError("Not a function");
                              e(n);
                            });
                          }),
                          e(g, "all", function(e) {
                            var s = this;
                            return "[object Array]" != t.call(e)
                              ? s.reject(TypeError("Not an array"))
                              : 0 === e.length
                              ? s.resolve([])
                              : new s(function(n, t) {
                                  if (
                                    "function" != typeof n ||
                                    "function" != typeof t
                                  )
                                    throw TypeError("Not a function");
                                  var i = e.length,
                                    o = Array(i),
                                    r = 0;
                                  p(
                                    s,
                                    e,
                                    function(t, e) {
                                      (o[t] = e), ++r === i && n(o);
                                    },
                                    t
                                  );
                                });
                          }),
                          e(g, "race", function(e) {
                            var i = this;
                            return "[object Array]" != t.call(e)
                              ? i.reject(TypeError("Not an array"))
                              : new i(function(n, t) {
                                  if (
                                    "function" != typeof n ||
                                    "function" != typeof t
                                  )
                                    throw TypeError("Not a function");
                                  p(
                                    i,
                                    e,
                                    function(t, e) {
                                      n(e);
                                    },
                                    t
                                  );
                                });
                          }),
                          g
                        );
                      }),
                        ((n = d)[(e = "Promise")] = n[e] || i()),
                        t.exports && (t.exports = n[e]);
                    })((m = { exports: {} })),
                    m.exports),
                  y = new WeakMap();
                function w(t, e, n) {
                  var i = y.get(t.element) || {};
                  e in i || (i[e] = []), i[e].push(n), y.set(t.element, i);
                }
                function E(t, e) {
                  return (y.get(t.element) || {})[e] || [];
                }
                function _(t, e, n) {
                  var i = y.get(t.element) || {};
                  if (!i[e]) return !0;
                  if (!n) return (i[e] = []), y.set(t.element, i), !0;
                  var o = i[e].indexOf(n);
                  return (
                    -1 !== o && i[e].splice(o, 1),
                    y.set(t.element, i),
                    i[e] && 0 === i[e].length
                  );
                }
                var P = [
                  "autopause",
                  "autoplay",
                  "background",
                  "byline",
                  "color",
                  "controls",
                  "dnt",
                  "height",
                  "id",
                  "loop",
                  "maxheight",
                  "maxwidth",
                  "muted",
                  "playsinline",
                  "portrait",
                  "responsive",
                  "speed",
                  "texttrack",
                  "title",
                  "transparent",
                  "url",
                  "width",
                ];
                function k(i, t) {
                  var e = 1 < arguments.length && void 0 !== t ? t : {};
                  return P.reduce(function(t, e) {
                    var n = i.getAttribute("data-vimeo-".concat(e));
                    return (!n && "" !== n) || (t[e] = "" === n ? 1 : n), t;
                  }, e);
                }
                function S(t, e) {
                  var n = t.html;
                  if (!e) throw new TypeError("An element must be provided");
                  if (null !== e.getAttribute("data-vimeo-initialized"))
                    return e.querySelector("iframe");
                  var i = document.createElement("div");
                  return (
                    (i.innerHTML = n),
                    e.appendChild(i.firstChild),
                    e.setAttribute("data-vimeo-initialized", "true"),
                    e.querySelector("iframe")
                  );
                }
                function T(r, t, e) {
                  var s = 1 < arguments.length && void 0 !== t ? t : {},
                    a = 2 < arguments.length ? e : void 0;
                  return new Promise(function(e, n) {
                    if (!c(r))
                      throw new TypeError(
                        "â€œ".concat(r, "â€ is not a vimeo.com url.")
                      );
                    var t = "https://vimeo.com/api/oembed.json?url=".concat(
                      encodeURIComponent(r)
                    );
                    for (var i in s)
                      s.hasOwnProperty(i) &&
                        (t += "&"
                          .concat(i, "=")
                          .concat(encodeURIComponent(s[i])));
                    var o = new ("XDomainRequest" in window
                      ? XDomainRequest
                      : XMLHttpRequest)();
                    o.open("GET", t, !0),
                      (o.onload = function() {
                        if (404 !== o.status)
                          if (403 !== o.status)
                            try {
                              var t = JSON.parse(o.responseText);
                              if (403 === t.domain_status_code)
                                return (
                                  S(t, a),
                                  void n(
                                    new Error(
                                      "â€œ".concat(r, "â€ is not embeddable.")
                                    )
                                  )
                                );
                              e(t);
                            } catch (t) {
                              n(t);
                            }
                          else
                            n(
                              new Error(
                                "â€œ".concat(r, "â€ is not embeddable.")
                              )
                            );
                        else n(new Error("â€œ".concat(r, "â€ was not found.")));
                      }),
                      (o.onerror = function() {
                        var t = o.status ? " (".concat(o.status, ")") : "";
                        n(
                          new Error(
                            "There was an error fetching the embed code from Vimeo".concat(
                              t,
                              "."
                            )
                          )
                        );
                      }),
                      o.send();
                  });
                }
                function x(t) {
                  if ("string" == typeof t)
                    try {
                      t = JSON.parse(t);
                    } catch (t) {
                      return console.warn(t), {};
                    }
                  return t;
                }
                function O(t, e, n) {
                  var i, o;
                  t.element.contentWindow &&
                    t.element.contentWindow.postMessage &&
                    ((i = { method: e }),
                    void 0 !== n && (i.value = n),
                    8 <=
                      (o = parseFloat(
                        navigator.userAgent
                          .toLowerCase()
                          .replace(/^.*msie (\d+).*$/, "$1")
                      )) &&
                      o < 10 &&
                      (i = JSON.stringify(i)),
                    t.element.contentWindow.postMessage(i, t.origin));
                }
                function L(n, i) {
                  var e,
                    t,
                    o = [];
                  (i = x(i)).event
                    ? ("error" === i.event &&
                        E(n, i.data.method).forEach(function(t) {
                          var e = new Error(i.data.message);
                          (e.name = i.data.name),
                            t.reject(e),
                            _(n, i.data.method, t);
                        }),
                      (o = E(n, "event:".concat(i.event))),
                      (e = i.data))
                    : !i.method ||
                      ((t = (function(t, e) {
                        var n = E(t, e);
                        if (n.length < 1) return !1;
                        var i = n.shift();
                        return _(t, e, i), i;
                      })(n, i.method)) &&
                        (o.push(t), (e = i.value))),
                    o.forEach(function(t) {
                      try {
                        if ("function" == typeof t) return void t.call(n, e);
                        t.resolve(e);
                      } catch (t) {}
                    });
                }
                var j = new WeakMap(),
                  M = new WeakMap(),
                  R = (function() {
                    function r(a) {
                      var t,
                        l = this,
                        n =
                          1 < arguments.length && void 0 !== arguments[1]
                            ? arguments[1]
                            : {};
                      if (
                        (!(
                          /*! @vimeo/player v2.10.0 | (c) 2019 Vimeo | MIT License | https://github.com/vimeo/player.js */
                          (function(t, e) {
                            if (!(t instanceof e))
                              throw new TypeError(
                                "Cannot call a class as a function"
                              );
                          })(this, r)
                        ),
                        window.jQuery &&
                          a instanceof jQuery &&
                          (1 < a.length &&
                            window.console &&
                            console.warn &&
                            console.warn(
                              "A jQuery object with multiple elements was passed, using the first element."
                            ),
                          (a = a[0])),
                        "undefined" != typeof document &&
                          "string" == typeof a &&
                          (a = document.getElementById(a)),
                        (t = a),
                        !Boolean(
                          t &&
                            1 === t.nodeType &&
                            "nodeName" in t &&
                            t.ownerDocument &&
                            t.ownerDocument.defaultView
                        ))
                      )
                        throw new TypeError(
                          "You must pass either a valid element or a valid id."
                        );
                      var e,
                        i = a.ownerDocument.defaultView;
                      if (
                        ("IFRAME" === a.nodeName ||
                          ((e = a.querySelector("iframe")) && (a = e)),
                        "IFRAME" === a.nodeName &&
                          !c(a.getAttribute("src") || ""))
                      )
                        throw new Error(
                          "The player element passed isnâ€™t a Vimeo embed."
                        );
                      if (j.has(a)) return j.get(a);
                      (this.element = a), (this.origin = "*");
                      var o = new g(function(r, s) {
                        function t(t) {
                          if (
                            c(t.origin) &&
                            l.element.contentWindow === t.source
                          ) {
                            "*" === l.origin && (l.origin = t.origin);
                            var e = x(t.data);
                            if (
                              e &&
                              "error" === e.event &&
                              e.data &&
                              "ready" === e.data.method
                            ) {
                              var n = new Error(e.data.message);
                              return (n.name = e.data.name), void s(n);
                            }
                            var i = e && "ready" === e.event,
                              o = e && "ping" === e.method;
                            if (i || o)
                              return (
                                l.element.setAttribute("data-ready", "true"),
                                void r()
                              );
                            L(l, e);
                          }
                        }
                        var e;
                        i.addEventListener
                          ? i.addEventListener("message", t, !1)
                          : i.attachEvent && i.attachEvent("onmessage", t),
                          "IFRAME" !== l.element.nodeName &&
                            T(u((e = k(a, n))), e, a)
                              .then(function(t) {
                                var e,
                                  n,
                                  i,
                                  o = S(t, a);
                                return (
                                  (l.element = o),
                                  (l._originalElement = a),
                                  (e = a),
                                  (n = o),
                                  (i = y.get(e)),
                                  y.set(n, i),
                                  y.delete(e),
                                  j.set(l.element, l),
                                  t
                                );
                              })
                              .catch(s);
                      });
                      return (
                        M.set(this, o),
                        j.set(this.element, this),
                        "IFRAME" === this.element.nodeName && O(this, "ping"),
                        this
                      );
                    }
                    var t, e, n;
                    return (
                      (t = r),
                      (e = [
                        {
                          key: "callMethod",
                          value: function(n, t) {
                            var i = this,
                              o = 1 < arguments.length && void 0 !== t ? t : {};
                            return new g(function(t, e) {
                              return i
                                .ready()
                                .then(function() {
                                  w(i, n, { resolve: t, reject: e }),
                                    O(i, n, o);
                                })
                                .catch(e);
                            });
                          },
                        },
                        {
                          key: "get",
                          value: function(n) {
                            var i = this;
                            return new g(function(t, e) {
                              return (
                                (n = s(n, "get")),
                                i
                                  .ready()
                                  .then(function() {
                                    w(i, n, { resolve: t, reject: e }), O(i, n);
                                  })
                                  .catch(e)
                              );
                            });
                          },
                        },
                        {
                          key: "set",
                          value: function(n, i) {
                            var o = this;
                            return new g(function(t, e) {
                              if (((n = s(n, "set")), null == i))
                                throw new TypeError(
                                  "There must be a value to set."
                                );
                              return o
                                .ready()
                                .then(function() {
                                  w(o, n, { resolve: t, reject: e }),
                                    O(o, n, i);
                                })
                                .catch(e);
                            });
                          },
                        },
                        {
                          key: "on",
                          value: function(t, e) {
                            if (!t)
                              throw new TypeError(
                                "You must pass an event name."
                              );
                            if (!e)
                              throw new TypeError(
                                "You must pass a callback function."
                              );
                            if ("function" != typeof e)
                              throw new TypeError(
                                "The callback must be a function."
                              );
                            0 === E(this, "event:".concat(t)).length &&
                              this.callMethod(
                                "addEventListener",
                                t
                              ).catch(function() {}),
                              w(this, "event:".concat(t), e);
                          },
                        },
                        {
                          key: "off",
                          value: function(t, e) {
                            if (!t)
                              throw new TypeError(
                                "You must pass an event name."
                              );
                            if (e && "function" != typeof e)
                              throw new TypeError(
                                "The callback must be a function."
                              );
                            _(this, "event:".concat(t), e) &&
                              this.callMethod(
                                "removeEventListener",
                                t
                              ).catch(function(t) {});
                          },
                        },
                        {
                          key: "loadVideo",
                          value: function(t) {
                            return this.callMethod("loadVideo", t);
                          },
                        },
                        {
                          key: "ready",
                          value: function() {
                            var t =
                              M.get(this) ||
                              new g(function(t, e) {
                                e(
                                  new Error(
                                    "Unknown player. Probably unloaded."
                                  )
                                );
                              });
                            return g.resolve(t);
                          },
                        },
                        {
                          key: "addCuePoint",
                          value: function(t, e) {
                            var n =
                              1 < arguments.length && void 0 !== e ? e : {};
                            return this.callMethod("addCuePoint", {
                              time: t,
                              data: n,
                            });
                          },
                        },
                        {
                          key: "removeCuePoint",
                          value: function(t) {
                            return this.callMethod("removeCuePoint", t);
                          },
                        },
                        {
                          key: "enableTextTrack",
                          value: function(t, e) {
                            if (!t)
                              throw new TypeError("You must pass a language.");
                            return this.callMethod("enableTextTrack", {
                              language: t,
                              kind: e,
                            });
                          },
                        },
                        {
                          key: "disableTextTrack",
                          value: function() {
                            return this.callMethod("disableTextTrack");
                          },
                        },
                        {
                          key: "pause",
                          value: function() {
                            return this.callMethod("pause");
                          },
                        },
                        {
                          key: "play",
                          value: function() {
                            return this.callMethod("play");
                          },
                        },
                        {
                          key: "unload",
                          value: function() {
                            return this.callMethod("unload");
                          },
                        },
                        {
                          key: "destroy",
                          value: function() {
                            var e = this;
                            return new g(function(t) {
                              M.delete(e),
                                j.delete(e.element),
                                e._originalElement &&
                                  (j.delete(e._originalElement),
                                  e._originalElement.removeAttribute(
                                    "data-vimeo-initialized"
                                  )),
                                e.element &&
                                  "IFRAME" === e.element.nodeName &&
                                  e.element.parentNode &&
                                  e.element.parentNode.removeChild(e.element),
                                t();
                            });
                          },
                        },
                        {
                          key: "getAutopause",
                          value: function() {
                            return this.get("autopause");
                          },
                        },
                        {
                          key: "setAutopause",
                          value: function(t) {
                            return this.set("autopause", t);
                          },
                        },
                        {
                          key: "getBuffered",
                          value: function() {
                            return this.get("buffered");
                          },
                        },
                        {
                          key: "getColor",
                          value: function() {
                            return this.get("color");
                          },
                        },
                        {
                          key: "setColor",
                          value: function(t) {
                            return this.set("color", t);
                          },
                        },
                        {
                          key: "getCuePoints",
                          value: function() {
                            return this.get("cuePoints");
                          },
                        },
                        {
                          key: "getCurrentTime",
                          value: function() {
                            return this.get("currentTime");
                          },
                        },
                        {
                          key: "setCurrentTime",
                          value: function(t) {
                            return this.set("currentTime", t);
                          },
                        },
                        {
                          key: "getDuration",
                          value: function() {
                            return this.get("duration");
                          },
                        },
                        {
                          key: "getEnded",
                          value: function() {
                            return this.get("ended");
                          },
                        },
                        {
                          key: "getLoop",
                          value: function() {
                            return this.get("loop");
                          },
                        },
                        {
                          key: "setLoop",
                          value: function(t) {
                            return this.set("loop", t);
                          },
                        },
                        {
                          key: "setMuted",
                          value: function(t) {
                            return this.set("muted", t);
                          },
                        },
                        {
                          key: "getMuted",
                          value: function() {
                            return this.get("muted");
                          },
                        },
                        {
                          key: "getPaused",
                          value: function() {
                            return this.get("paused");
                          },
                        },
                        {
                          key: "getPlaybackRate",
                          value: function() {
                            return this.get("playbackRate");
                          },
                        },
                        {
                          key: "setPlaybackRate",
                          value: function(t) {
                            return this.set("playbackRate", t);
                          },
                        },
                        {
                          key: "getPlayed",
                          value: function() {
                            return this.get("played");
                          },
                        },
                        {
                          key: "getSeekable",
                          value: function() {
                            return this.get("seekable");
                          },
                        },
                        {
                          key: "getSeeking",
                          value: function() {
                            return this.get("seeking");
                          },
                        },
                        {
                          key: "getTextTracks",
                          value: function() {
                            return this.get("textTracks");
                          },
                        },
                        {
                          key: "getVideoEmbedCode",
                          value: function() {
                            return this.get("videoEmbedCode");
                          },
                        },
                        {
                          key: "getVideoId",
                          value: function() {
                            return this.get("videoId");
                          },
                        },
                        {
                          key: "getVideoTitle",
                          value: function() {
                            return this.get("videoTitle");
                          },
                        },
                        {
                          key: "getVideoWidth",
                          value: function() {
                            return this.get("videoWidth");
                          },
                        },
                        {
                          key: "getVideoHeight",
                          value: function() {
                            return this.get("videoHeight");
                          },
                        },
                        {
                          key: "getVideoUrl",
                          value: function() {
                            return this.get("videoUrl");
                          },
                        },
                        {
                          key: "getVolume",
                          value: function() {
                            return this.get("volume");
                          },
                        },
                        {
                          key: "setVolume",
                          value: function(t) {
                            return this.set("volume", t);
                          },
                        },
                      ]) && i(t.prototype, e),
                      n && i(t, n),
                      r
                    );
                  })();
                e ||
                  ((function(t) {
                    function n(t) {
                      "console" in window &&
                        console.error &&
                        console.error(
                          "There was an error creating an embed: ".concat(t)
                        );
                    }
                    var e = 0 < arguments.length && void 0 !== t ? t : document;
                    [].slice
                      .call(
                        e.querySelectorAll("[data-vimeo-id], [data-vimeo-url]")
                      )
                      .forEach(function(e) {
                        try {
                          if (null !== e.getAttribute("data-vimeo-defer"))
                            return;
                          var t = k(e);
                          T(u(t), t, e)
                            .then(function(t) {
                              return S(t, e);
                            })
                            .catch(n);
                        } catch (t) {
                          n(t);
                        }
                      });
                  })(),
                  (function(t) {
                    var e,
                      i = 0 < arguments.length && void 0 !== t ? t : document;
                    window.VimeoPlayerResizeEmbeds_ ||
                      ((window.VimeoPlayerResizeEmbeds_ = !0),
                      (e = function(t) {
                        if (
                          c(t.origin) &&
                          t.data &&
                          "spacechange" === t.data.event
                        )
                          for (
                            var e = i.querySelectorAll("iframe"), n = 0;
                            n < e.length;
                            n++
                          )
                            if (e[n].contentWindow === t.source) {
                              e[
                                n
                              ].parentElement.style.paddingBottom = "".concat(
                                t.data.data[0].bottom,
                                "px"
                              );
                              break;
                            }
                      }),
                      window.addEventListener
                        ? window.addEventListener("message", e, !1)
                        : window.attachEvent &&
                          window.attachEvent("onmessage", e));
                  })()),
                  (C.a = R);
              }.call(this, e(0), e(2).setImmediate));
            },
            function(t, o, r) {
              (function(t) {
                var e =
                    (void 0 !== t && t) ||
                    ("undefined" != typeof self && self) ||
                    window,
                  n = Function.prototype.apply;
                function i(t, e) {
                  (this._id = t), (this._clearFn = e);
                }
                (o.setTimeout = function() {
                  return new i(n.call(setTimeout, e, arguments), clearTimeout);
                }),
                  (o.setInterval = function() {
                    return new i(
                      n.call(setInterval, e, arguments),
                      clearInterval
                    );
                  }),
                  (o.clearTimeout = o.clearInterval = function(t) {
                    t && t.close();
                  }),
                  (i.prototype.unref = i.prototype.ref = function() {}),
                  (i.prototype.close = function() {
                    this._clearFn.call(e, this._id);
                  }),
                  (o.enroll = function(t, e) {
                    clearTimeout(t._idleTimeoutId), (t._idleTimeout = e);
                  }),
                  (o.unenroll = function(t) {
                    clearTimeout(t._idleTimeoutId), (t._idleTimeout = -1);
                  }),
                  (o._unrefActive = o.active = function(t) {
                    clearTimeout(t._idleTimeoutId);
                    var e = t._idleTimeout;
                    0 <= e &&
                      (t._idleTimeoutId = setTimeout(function() {
                        t._onTimeout && t._onTimeout();
                      }, e));
                  }),
                  r(3),
                  (o.setImmediate =
                    ("undefined" != typeof self && self.setImmediate) ||
                    (void 0 !== t && t.setImmediate) ||
                    (this && this.setImmediate)),
                  (o.clearImmediate =
                    ("undefined" != typeof self && self.clearImmediate) ||
                    (void 0 !== t && t.clearImmediate) ||
                    (this && this.clearImmediate));
              }.call(this, r(0)));
            },
            function(t, e, n) {
              (function(t, p) {
                !(function(n, i) {
                  "use strict";
                  var o, r, s, a, l, c, e, u, t;
                  function d(t) {
                    delete r[t];
                  }
                  function f(t) {
                    if (s) setTimeout(f, 0, t);
                    else {
                      var e = r[t];
                      if (e) {
                        s = !0;
                        try {
                          !(function(t) {
                            var e = t.callback,
                              n = t.args;
                            switch (n.length) {
                              case 0:
                                e();
                                break;
                              case 1:
                                e(n[0]);
                                break;
                              case 2:
                                e(n[0], n[1]);
                                break;
                              case 3:
                                e(n[0], n[1], n[2]);
                                break;
                              default:
                                e.apply(i, n);
                            }
                          })(e);
                        } finally {
                          d(t), (s = !1);
                        }
                      }
                    }
                  }
                  function h(t) {
                    t.source === n &&
                      "string" == typeof t.data &&
                      0 === t.data.indexOf(u) &&
                      f(+t.data.slice(u.length));
                  }
                  n.setImmediate ||
                    ((o = 1),
                    (s = !(r = {})),
                    (a = n.document),
                    (t =
                      (t = Object.getPrototypeOf && Object.getPrototypeOf(n)) &&
                      t.setTimeout
                        ? t
                        : n),
                    (l =
                      "[object process]" === {}.toString.call(n.process)
                        ? function(t) {
                            p.nextTick(function() {
                              f(t);
                            });
                          }
                        : (function() {
                            if (n.postMessage && !n.importScripts) {
                              var t = !0,
                                e = n.onmessage;
                              return (
                                (n.onmessage = function() {
                                  t = !1;
                                }),
                                n.postMessage("", "*"),
                                (n.onmessage = e),
                                t
                              );
                            }
                          })()
                        ? ((u = "setImmediate$" + Math.random() + "$"),
                          n.addEventListener
                            ? n.addEventListener("message", h, !1)
                            : n.attachEvent("onmessage", h),
                          function(t) {
                            n.postMessage(u + t, "*");
                          })
                        : n.MessageChannel
                        ? (((e = new MessageChannel()).port1.onmessage = function(
                            t
                          ) {
                            f(t.data);
                          }),
                          function(t) {
                            e.port2.postMessage(t);
                          })
                        : a && "onreadystatechange" in a.createElement("script")
                        ? ((c = a.documentElement),
                          function(t) {
                            var e = a.createElement("script");
                            (e.onreadystatechange = function() {
                              f(t),
                                (e.onreadystatechange = null),
                                c.removeChild(e),
                                (e = null);
                            }),
                              c.appendChild(e);
                          })
                        : function(t) {
                            setTimeout(f, 0, t);
                          }),
                    (t.setImmediate = function(t) {
                      "function" != typeof t && (t = new Function("" + t));
                      for (
                        var e = new Array(arguments.length - 1), n = 0;
                        n < e.length;
                        n++
                      )
                        e[n] = arguments[n + 1];
                      var i = { callback: t, args: e };
                      return (r[o] = i), l(o), o++;
                    }),
                    (t.clearImmediate = d));
                })(
                  "undefined" == typeof self ? (void 0 === t ? this : t) : self
                );
              }.call(this, n(0), n(4)));
            },
            function(t, e) {
              var n,
                i,
                o = (t.exports = {});
              function r() {
                throw new Error("setTimeout has not been defined");
              }
              function s() {
                throw new Error("clearTimeout has not been defined");
              }
              function a(e) {
                if (n === setTimeout) return setTimeout(e, 0);
                if ((n === r || !n) && setTimeout)
                  return (n = setTimeout), setTimeout(e, 0);
                try {
                  return n(e, 0);
                } catch (t) {
                  try {
                    return n.call(null, e, 0);
                  } catch (t) {
                    return n.call(this, e, 0);
                  }
                }
              }
              !(function() {
                try {
                  n = "function" == typeof setTimeout ? setTimeout : r;
                } catch (t) {
                  n = r;
                }
                try {
                  i = "function" == typeof clearTimeout ? clearTimeout : s;
                } catch (t) {
                  i = s;
                }
              })();
              var l,
                c = [],
                u = !1,
                d = -1;
              function f() {
                u &&
                  l &&
                  ((u = !1),
                  l.length ? (c = l.concat(c)) : (d = -1),
                  c.length && h());
              }
              function h() {
                if (!u) {
                  var t = a(f);
                  u = !0;
                  for (var e = c.length; e; ) {
                    for (l = c, c = []; ++d < e; ) l && l[d].run();
                    (d = -1), (e = c.length);
                  }
                  (l = null),
                    (u = !1),
                    (function(e) {
                      if (i === clearTimeout) return clearTimeout(e);
                      if ((i === s || !i) && clearTimeout)
                        return (i = clearTimeout), clearTimeout(e);
                      try {
                        i(e);
                      } catch (t) {
                        try {
                          return i.call(null, e);
                        } catch (t) {
                          return i.call(this, e);
                        }
                      }
                    })(t);
                }
              }
              function p(t, e) {
                (this.fun = t), (this.array = e);
              }
              function v() {}
              (o.nextTick = function(t) {
                var e = new Array(arguments.length - 1);
                if (1 < arguments.length)
                  for (var n = 1; n < arguments.length; n++)
                    e[n - 1] = arguments[n];
                c.push(new p(t, e)), 1 !== c.length || u || a(h);
              }),
                (p.prototype.run = function() {
                  this.fun.apply(null, this.array);
                }),
                (o.title = "browser"),
                (o.browser = !0),
                (o.env = {}),
                (o.argv = []),
                (o.version = ""),
                (o.versions = {}),
                (o.on = v),
                (o.addListener = v),
                (o.once = v),
                (o.off = v),
                (o.removeListener = v),
                (o.removeAllListeners = v),
                (o.emit = v),
                (o.prependListener = v),
                (o.prependOnceListener = v),
                (o.listeners = function(t) {
                  return [];
                }),
                (o.binding = function(t) {
                  throw new Error("process.binding is not supported");
                }),
                (o.cwd = function() {
                  return "/";
                }),
                (o.chdir = function(t) {
                  throw new Error("process.chdir is not supported");
                }),
                (o.umask = function() {
                  return 0;
                });
            },
            function(t, e, n) {
              "use strict";
              function s(n, i) {
                Object.keys(n).some(function(t, e) {
                  return i(n[t], t, e);
                });
              }
              n.r(e);
              function i(e, n) {
                function i(t) {
                  return document.createElement(t);
                }
                function t(t) {
                  var e = t.parentElement;
                  e && e.removeChild(t);
                }
                return {
                  init: function() {
                    this.initElements(),
                      this.toggleWrapper(!1),
                      this.togglePlayButton(!1);
                  },
                  initElements: function() {
                    var t = (function(e, n) {
                      return (
                        Object.keys(e.children)
                          .map(function(t) {
                            return e.children[t];
                          })
                          .filter(function(t) {
                            return t.classList.contains(n);
                          })[0] || null
                      );
                    })(n, e.classes.container.split(" ")[0] || "");
                    (this.parent = t || n),
                      (this.className =
                        e.classes[t ? "container" : "slide"].split(" ")[0] +
                        "--has-video"),
                      this.parent.classList.add(this.className),
                      (this.wrapper = i("div")),
                      (this.iframe = i("div")),
                      (this.playButton = i("button")),
                      this.wrapper.classList.add("splide__video"),
                      this.playButton.classList.add("splide__video__play"),
                      this.wrapper.appendChild(this.iframe),
                      this.parent.appendChild(this.wrapper),
                      this.parent.appendChild(this.playButton);
                  },
                  destroy: function() {
                    this.parent.classList.remove(this.className),
                      t(this.wrapper),
                      t(this.playButton);
                  },
                  togglePlayButton: function(t) {
                    this.playButton.style.display = t ? "flex" : "none";
                  },
                  toggleWrapper: function(t) {
                    this.wrapper.style.display = t ? "block" : "none";
                  },
                  hide: function() {
                    this.togglePlayButton(!1), this.toggleWrapper(!0);
                  },
                  show: function() {
                    this.togglePlayButton(!0), this.toggleWrapper(!1);
                  },
                };
              }
              function o(t) {
                var e = t;
                return {
                  set: function(t) {
                    e = t;
                  },
                  is: function() {
                    for (var t = 0; t < arguments.length; t++)
                      if (
                        (t < 0 || arguments.length <= t
                          ? void 0
                          : arguments[t]) === e
                      )
                        return !0;
                    return !1;
                  },
                };
              }
              var r = (function() {
                  function t(t, e) {
                    (this.Splide = t),
                      (this.Components = e),
                      (this.players = []);
                  }
                  var e = t.prototype;
                  return (
                    (e.createPlayers = function(e, n) {
                      var i = this;
                      this.Components.Elements.getSlides(!0).forEach(function(
                        t
                      ) {
                        i.Components.Grid &&
                          s(
                            t.slide.querySelectorAll(
                              "." + i.Components.Grid.colClass
                            ),
                            function(t) {
                              i.createPlayer(t, e, n);
                            }
                          ),
                          i.createPlayer(t.slide, e, n);
                      });
                    }),
                    (e.createPlayer = function(t, e, n) {
                      t.getAttribute(n) &&
                        this.players.push(
                          new e(this.Splide, this.Components, t)
                        );
                    }),
                    (e.destroy = function() {
                      this.players.forEach(function(t) {
                        t.destroy();
                      });
                    }),
                    t
                  );
                })(),
                a = (function() {
                  function t(t, e, n) {
                    (this.Splide = t),
                      (this.Components = e),
                      (this.slide = n),
                      (this.player = null),
                      (this.elements = null),
                      (this.state = new o(1)),
                      (this.videoId = this.findVideoId()),
                      this.videoId &&
                        (this.init(), this.bind(), this.handleClick());
                  }
                  var e = t.prototype;
                  return (
                    (e.init = function() {
                      (this.elements = new i(this.Splide, this.slide)),
                        this.elements.init(),
                        this.toggleRootClass(!0),
                        this.elements.togglePlayButton(
                          !this.Splide.options.video.disableOverlayUI
                        ),
                        this.isAutoplay() && this.isActive() && this.play();
                    }),
                    (e.setup = function() {
                      var e = this;
                      this.state.set(2),
                        (this.player = this.createPlayer(function() {
                          var t = e.state.is(3);
                          e.state.set(4), t && e.play();
                        }));
                    }),
                    (e.bind = function() {
                      var e = this;
                      this.Splide.on("active", function(t) {
                        e.isAutoplay() &&
                          (t.slide === e.slide ? e.play() : e.pause());
                      })
                        .on("move", function() {
                          e.pause();
                        })
                        .on("video:click", function(t) {
                          t.slide !== e.slide && e.pause();
                        });
                    }),
                    (e.handleClick = function() {
                      var t = this;
                      this.slide.addEventListener(
                        "mousedown",
                        this.onMouseDown.bind(this)
                      ),
                        this.slide.addEventListener(
                          "touchstart",
                          this.onMouseDown.bind(this)
                        ),
                        this.slide.addEventListener(
                          "mouseup",
                          this.onMouseUp.bind(this)
                        ),
                        this.slide.addEventListener(
                          "touchend",
                          this.onMouseUp.bind(this)
                        ),
                        this.Splide.on("drag", function() {
                          t.shouldHandleClick = !1;
                        });
                    }),
                    (e.createPlayer = function(t) {
                      return void 0 === t && (t = null), null;
                    }),
                    (e.play = function() {
                      var t = this;
                      this.state.is(1) && this.setup(),
                        this.state.is(7, 3) ||
                          (setTimeout(function() {
                            t.elements.hide();
                          }),
                          this.state.is(2)
                            ? this.state.set(3)
                            : (this.state.is(6) || this.playVideo(),
                              this.state.set(5)));
                    }),
                    (e.pause = function() {
                      this.Splide.options.video.disableOverlayUI ||
                        this.elements.show(),
                        this.state.is(3)
                          ? this.state.set(2)
                          : this.state.is(5)
                          ? this.state.set(6)
                          : this.state.is(7) &&
                            (this.state.set(4), this.pauseVideo());
                    }),
                    (e.playVideo = function() {
                      this.player.play();
                    }),
                    (e.pauseVideo = function() {
                      this.player.pause();
                    }),
                    (e.isActive = function() {
                      return this.slide.classList.contains("is-active");
                    }),
                    (e.isAutoplay = function() {
                      return this.Splide.options.video.autoplay;
                    }),
                    (e.findVideoId = function() {
                      return "";
                    }),
                    (e.toggleRootClass = function(t) {
                      this.Splide.root.classList[t ? "add" : "remove"](
                        this.Splide.classes.root.split(" ")[0] + "--has-video"
                      );
                    }),
                    (e.onMouseDown = function() {
                      this.shouldHandleClick = !0;
                    }),
                    (e.onMouseUp = function() {
                      this.shouldHandleClick &&
                        (this.Splide.emit("video:click", this), this.play());
                    }),
                    (e.onPlay = function() {
                      this.state.is(6)
                        ? (this.state.set(7), this.pause())
                        : (this.Splide.emit("video:play", this),
                          this.state.set(7));
                    }),
                    (e.onPause = function() {
                      this.Splide.emit("video:pause", this), this.state.set(4);
                    }),
                    (e.onEnded = function() {
                      this.Splide.emit("video:ended", this), this.state.set(4);
                    }),
                    (e.destroy = function() {
                      this.player &&
                        (this.player.destroy(), (this.player = null)),
                        this.toggleRootClass(!1),
                        this.elements.destroy(),
                        this.slide.removeEventListener(
                          "mousedown",
                          this.onMouseDown.bind(this)
                        ),
                        this.slide.removeEventListener(
                          "touchstart",
                          this.onMouseDown.bind(this)
                        ),
                        this.slide.removeEventListener(
                          "mouseup",
                          this.onMouseUp.bind(this)
                        ),
                        this.slide.removeEventListener(
                          "touchend",
                          this.onMouseUp.bind(this)
                        );
                    }),
                    t
                  );
                })();
              function l(r) {
                return function() {
                  var t,
                    e,
                    n,
                    i,
                    o = c(r);
                  return (
                    (e = (function() {
                      if ("undefined" == typeof Reflect || !Reflect.construct)
                        return !1;
                      if (Reflect.construct.sham) return !1;
                      if ("function" == typeof Proxy) return !0;
                      try {
                        return (
                          Date.prototype.toString.call(
                            Reflect.construct(Date, [], function() {})
                          ),
                          !0
                        );
                      } catch (t) {
                        return !1;
                      }
                    })()
                      ? ((t = c(this).constructor),
                        Reflect.construct(o, arguments, t))
                      : o.apply(this, arguments)),
                    (n = this),
                    !(i = e) || ("object" != typeof i && "function" != typeof i)
                      ? (function(t) {
                          if (void 0 !== t) return t;
                          throw new ReferenceError(
                            "this hasn't been initialised - super() hasn't been called"
                          );
                        })(n)
                      : i
                  );
                };
              }
              function c(t) {
                return (c = Object.setPrototypeOf
                  ? Object.getPrototypeOf
                  : function(t) {
                      return t.__proto__ || Object.getPrototypeOf(t);
                    })(t);
              }
              var u = [
                  "autoplay",
                  "autoPictureInPicture",
                  "controls",
                  "controlslist",
                  "crossorigin",
                  "currentTime",
                  "disablePictureInPicture",
                  "disableRemotePlayback",
                  "height",
                  "intrinsicsize",
                  "loop",
                  "muted",
                  "playsinline",
                  "poster",
                  "preload",
                  "width",
                ],
                d = (function(t) {
                  var e, n;
                  (n = t),
                    ((e = i).prototype = Object.create(n.prototype)),
                    ((e.prototype.constructor = e).__proto__ = n);
                  l(i);
                  function i() {
                    return t.apply(this, arguments) || this;
                  }
                  var o = i.prototype;
                  return (
                    (o.createPlayer = function(t) {
                      void 0 === t && (t = null);
                      var e = this.Splide.options.video,
                        n = e.playerOptions.htmlVideo,
                        i = void 0 === n ? {} : n,
                        o = document.createElement("video");
                      return (
                        (o.src = this.videoId),
                        this.elements.iframe.appendChild(o),
                        (o.controls = !e.hideControls),
                        (o.loop = e.loop),
                        (o.volume = Math.max(Math.min(e.volume, 1), 0)),
                        (o.muted = e.mute),
                        s(i, function(t, e) {
                          -1 < u.indexOf(e) && (o[e] = t);
                        }),
                        o.addEventListener("play", this.onPlay.bind(this)),
                        o.addEventListener("pause", this.onPause.bind(this)),
                        o.addEventListener("ended", this.onEnded.bind(this)),
                        t && o.addEventListener("loadeddata", t),
                        o
                      );
                    }),
                    (o.findVideoId = function() {
                      return this.slide.getAttribute("data-splide-html-video");
                    }),
                    (o.destroy = function() {
                      this.player &&
                        (this.player.pause(),
                        this.player.removeAttribute("src"),
                        this.player.load(),
                        this.elements.iframe.removeChild(this.player),
                        (this.player = null)),
                        this.elements.destroy();
                    }),
                    i
                  );
                })(a);
              function f(r) {
                return function() {
                  var t,
                    e,
                    n,
                    i,
                    o = h(r);
                  return (
                    (e = (function() {
                      if ("undefined" == typeof Reflect || !Reflect.construct)
                        return !1;
                      if (Reflect.construct.sham) return !1;
                      if ("function" == typeof Proxy) return !0;
                      try {
                        return (
                          Date.prototype.toString.call(
                            Reflect.construct(Date, [], function() {})
                          ),
                          !0
                        );
                      } catch (t) {
                        return !1;
                      }
                    })()
                      ? ((t = h(this).constructor),
                        Reflect.construct(o, arguments, t))
                      : o.apply(this, arguments)),
                    (n = this),
                    !(i = e) || ("object" != typeof i && "function" != typeof i)
                      ? (function(t) {
                          if (void 0 !== t) return t;
                          throw new ReferenceError(
                            "this hasn't been initialised - super() hasn't been called"
                          );
                        })(n)
                      : i
                  );
                };
              }
              function h(t) {
                return (h = Object.setPrototypeOf
                  ? Object.getPrototypeOf
                  : function(t) {
                      return t.__proto__ || Object.getPrototypeOf(t);
                    })(t);
              }
              var p = (function(i) {
                var t, e;
                (e = i),
                  ((t = n).prototype = Object.create(e.prototype)),
                  ((t.prototype.constructor = t).__proto__ = e);
                f(n);
                function n(t, e) {
                  var n = i.call(this, t, e) || this;
                  return n.createPlayers(d, "data-splide-html-video"), n;
                }
                return n;
              })(r);
              function v() {
                return (v =
                  Object.assign ||
                  function(t) {
                    for (var e = 1; e < arguments.length; e++) {
                      var n = arguments[e];
                      for (var i in n)
                        Object.prototype.hasOwnProperty.call(n, i) &&
                          (t[i] = n[i]);
                    }
                    return t;
                  }).apply(this, arguments);
              }
              function m(r) {
                return function() {
                  var t,
                    e,
                    n,
                    i,
                    o = g(r);
                  return (
                    (e = (function() {
                      if ("undefined" == typeof Reflect || !Reflect.construct)
                        return !1;
                      if (Reflect.construct.sham) return !1;
                      if ("function" == typeof Proxy) return !0;
                      try {
                        return (
                          Date.prototype.toString.call(
                            Reflect.construct(Date, [], function() {})
                          ),
                          !0
                        );
                      } catch (t) {
                        return !1;
                      }
                    })()
                      ? ((t = g(this).constructor),
                        Reflect.construct(o, arguments, t))
                      : o.apply(this, arguments)),
                    (n = this),
                    !(i = e) || ("object" != typeof i && "function" != typeof i)
                      ? (function(t) {
                          if (void 0 !== t) return t;
                          throw new ReferenceError(
                            "this hasn't been initialised - super() hasn't been called"
                          );
                        })(n)
                      : i
                  );
                };
              }
              function g(t) {
                return (g = Object.setPrototypeOf
                  ? Object.getPrototypeOf
                  : function(t) {
                      return t.__proto__ || Object.getPrototypeOf(t);
                    })(t);
              }
              var y = (function(t) {
                var e, n;
                (n = t),
                  ((e = i).prototype = Object.create(n.prototype)),
                  ((e.prototype.constructor = e).__proto__ = n);
                m(i);
                function i() {
                  return t.apply(this, arguments) || this;
                }
                var o = i.prototype;
                return (
                  (o.createPlayer = function(e) {
                    var n = this;
                    void 0 === e && (e = null);
                    var t = this.Splide.options.video,
                      i = t.playerOptions.youtube,
                      o = void 0 === i ? {} : i;
                    return new YT.Player(this.elements.iframe, {
                      videoId: this.videoId,
                      playerVars: v(
                        {
                          controls: t.hideControls ? 0 : 1,
                          iv_load_policy: 3,
                          loop: t.loop,
                          playlist: t.loop ? this.videoId : "",
                          rel: 0,
                          autoplay: !1,
                        },
                        o
                      ),
                      events: {
                        onReady: function(t) {
                          n.onPlayerReady(t), e && e();
                        },
                        onStateChange: this.onPlayerStateChange.bind(this),
                      },
                    });
                  }),
                  (o.onPlayerReady = function(t) {
                    var e = t.target,
                      n = this.Splide.options.video;
                    n.mute && e.mute(),
                      e.setVolume(Math.max(Math.min(100 * n.volume, 100), 0));
                  }),
                  (o.onPlayerStateChange = function(t) {
                    var e = YT.PlayerState,
                      n = e.PLAYING,
                      i = e.PAUSED,
                      o = e.ENDED;
                    switch (!0) {
                      case t.data === n:
                        this.onPlay();
                        break;
                      case t.data === i:
                        this.onPause();
                        break;
                      case t.data === o:
                        this.onEnded();
                    }
                  }),
                  (o.playVideo = function() {
                    this.player.playVideo();
                  }),
                  (o.pauseVideo = function() {
                    this.player.pauseVideo();
                  }),
                  (o.findVideoId = function() {
                    var t = this.slide
                      .getAttribute("data-splide-youtube")
                      .match(
                        /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/
                      );
                    return t && 11 === t[7].length ? t[7] : "";
                  }),
                  i
                );
              })(a);
              function b(r) {
                return function() {
                  var t,
                    e,
                    n,
                    i,
                    o = w(r);
                  return (
                    (e = (function() {
                      if ("undefined" == typeof Reflect || !Reflect.construct)
                        return !1;
                      if (Reflect.construct.sham) return !1;
                      if ("function" == typeof Proxy) return !0;
                      try {
                        return (
                          Date.prototype.toString.call(
                            Reflect.construct(Date, [], function() {})
                          ),
                          !0
                        );
                      } catch (t) {
                        return !1;
                      }
                    })()
                      ? ((t = w(this).constructor),
                        Reflect.construct(o, arguments, t))
                      : o.apply(this, arguments)),
                    (n = this),
                    !(i = e) || ("object" != typeof i && "function" != typeof i)
                      ? (function(t) {
                          if (void 0 !== t) return t;
                          throw new ReferenceError(
                            "this hasn't been initialised - super() hasn't been called"
                          );
                        })(n)
                      : i
                  );
                };
              }
              function w(t) {
                return (w = Object.setPrototypeOf
                  ? Object.getPrototypeOf
                  : function(t) {
                      return t.__proto__ || Object.getPrototypeOf(t);
                    })(t);
              }
              var E = "https://www.youtube.com/player_api",
                _ = (function(i) {
                  var t, e;
                  (e = i),
                    ((t = n).prototype = Object.create(e.prototype)),
                    ((t.prototype.constructor = t).__proto__ = e);
                  b(n);
                  function n(t, e) {
                    var n = i.call(this, t, e) || this;
                    return (
                      (n.oldCallback = void 0),
                      n.bindAPICallback(),
                      n.loadAPI(),
                      n
                    );
                  }
                  var o = n.prototype;
                  return (
                    (o.loadAPI = function() {
                      var t,
                        e,
                        n = window.YT;
                      this.shouldLoadAPI()
                        ? ((t = document.createElement("script")),
                          (e = document.getElementsByTagName("script")[0]),
                          (t.src = E),
                          e.parentNode.insertBefore(t, e))
                        : n && n.loaded && this.onReady();
                    }),
                    (o.shouldLoadAPI = function() {
                      for (
                        var t = document.getElementsByTagName("script"), e = 0;
                        e < t.length;
                        e++
                      )
                        if (t[e].getAttribute("src") === E) return !1;
                      return !0;
                    }),
                    (o.bindAPICallback = function() {
                      void 0 !== window.onYouTubeIframeAPIReady &&
                        (this.oldCallback = window.onYouTubeIframeAPIReady),
                        (window.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady.bind(
                          this
                        ));
                    }),
                    (o.onYouTubeIframeAPIReady = function() {
                      this.oldCallback && this.oldCallback(), this.onReady();
                    }),
                    (o.onReady = function() {
                      this.createPlayers(y, "data-splide-youtube");
                    }),
                    n
                  );
                })(r),
                P = n(1);
              function k() {
                return (k =
                  Object.assign ||
                  function(t) {
                    for (var e = 1; e < arguments.length; e++) {
                      var n = arguments[e];
                      for (var i in n)
                        Object.prototype.hasOwnProperty.call(n, i) &&
                          (t[i] = n[i]);
                    }
                    return t;
                  }).apply(this, arguments);
              }
              function S(r) {
                return function() {
                  var t,
                    e,
                    n,
                    i,
                    o = T(r);
                  return (
                    (e = (function() {
                      if ("undefined" == typeof Reflect || !Reflect.construct)
                        return !1;
                      if (Reflect.construct.sham) return !1;
                      if ("function" == typeof Proxy) return !0;
                      try {
                        return (
                          Date.prototype.toString.call(
                            Reflect.construct(Date, [], function() {})
                          ),
                          !0
                        );
                      } catch (t) {
                        return !1;
                      }
                    })()
                      ? ((t = T(this).constructor),
                        Reflect.construct(o, arguments, t))
                      : o.apply(this, arguments)),
                    (n = this),
                    !(i = e) || ("object" != typeof i && "function" != typeof i)
                      ? (function(t) {
                          if (void 0 !== t) return t;
                          throw new ReferenceError(
                            "this hasn't been initialised - super() hasn't been called"
                          );
                        })(n)
                      : i
                  );
                };
              }
              function T(t) {
                return (T = Object.setPrototypeOf
                  ? Object.getPrototypeOf
                  : function(t) {
                      return t.__proto__ || Object.getPrototypeOf(t);
                    })(t);
              }
              var x = (function(t) {
                var e, n;
                (n = t),
                  ((e = i).prototype = Object.create(n.prototype)),
                  ((e.prototype.constructor = e).__proto__ = n);
                S(i);
                function i() {
                  return t.apply(this, arguments) || this;
                }
                var o = i.prototype;
                return (
                  (o.createPlayer = function(t) {
                    void 0 === t && (t = null);
                    var e = this.Splide.options.video,
                      n = e.playerOptions.vimeo,
                      i = void 0 === n ? {} : n,
                      o = new P.a(
                        this.elements.iframe,
                        k(
                          {
                            id: this.videoId,
                            controls: !e.hideControls,
                            loop: e.loop,
                          },
                          i
                        )
                      );
                    return (
                      o.on("play", this.onPlay.bind(this)),
                      o.on("pause", this.onPause.bind(this)),
                      o.on("ended", this.onEnded.bind(this)),
                      o.setVolume(Math.max(Math.min(e.volume, 1), 0)),
                      o.setMuted(i.muted || e.mute),
                      t && o.ready().then(t),
                      o
                    );
                  }),
                  (o.findVideoId = function() {
                    var t = this.slide
                      .getAttribute("data-splide-vimeo")
                      .match(/vimeo.com\/(\d+)/);
                    return t && t[1] ? t[1] : "";
                  }),
                  (o.onPlay = function() {
                    this.state.is(6) && !this.isActive()
                      ? (this.player.destroy(),
                        this.elements.show(),
                        this.state.set(1))
                      : (this.Splide.emit("video:play", this),
                        this.state.set(7));
                  }),
                  i
                );
              })(a);
              function O(r) {
                return function() {
                  var t,
                    e,
                    n,
                    i,
                    o = L(r);
                  return (
                    (e = (function() {
                      if ("undefined" == typeof Reflect || !Reflect.construct)
                        return !1;
                      if (Reflect.construct.sham) return !1;
                      if ("function" == typeof Proxy) return !0;
                      try {
                        return (
                          Date.prototype.toString.call(
                            Reflect.construct(Date, [], function() {})
                          ),
                          !0
                        );
                      } catch (t) {
                        return !1;
                      }
                    })()
                      ? ((t = L(this).constructor),
                        Reflect.construct(o, arguments, t))
                      : o.apply(this, arguments)),
                    (n = this),
                    !(i = e) || ("object" != typeof i && "function" != typeof i)
                      ? (function(t) {
                          if (void 0 !== t) return t;
                          throw new ReferenceError(
                            "this hasn't been initialised - super() hasn't been called"
                          );
                        })(n)
                      : i
                  );
                };
              }
              function L(t) {
                return (L = Object.setPrototypeOf
                  ? Object.getPrototypeOf
                  : function(t) {
                      return t.__proto__ || Object.getPrototypeOf(t);
                    })(t);
              }
              var j = {
                  HtmlVideo: p,
                  YouTube: _,
                  Vimeo: (function(i) {
                    var t, e;
                    (e = i),
                      ((t = n).prototype = Object.create(e.prototype)),
                      ((t.prototype.constructor = t).__proto__ = e);
                    O(n);
                    function n(t, e) {
                      var n = i.call(this, t, e) || this;
                      return n.createPlayers(x, "data-splide-vimeo"), n;
                    }
                    return n;
                  })(r),
                },
                M = {
                  autoplay: !1,
                  disableOverlayUI: !1,
                  hideControls: !1,
                  loop: !1,
                  mute: !1,
                  volume: 0.2,
                  playerOptions: {},
                };
              function R() {
                return (R =
                  Object.assign ||
                  function(t) {
                    for (var e = 1; e < arguments.length; e++) {
                      var n = arguments[e];
                      for (var i in n)
                        Object.prototype.hasOwnProperty.call(n, i) &&
                          (t[i] = n[i]);
                    }
                    return t;
                  }).apply(this, arguments);
              }
              var C = "is-playing";
              e.default = function(n, i) {
                var o,
                  r = [];
                return {
                  mount: function() {
                    var e;
                    "object" != typeof n.options.video &&
                      (n.options.video = {}),
                      (n.options.video = R({}, M, {}, n.options.video)),
                      s(j, function(t) {
                        r.push(new t(n, i));
                      }),
                      (e = n.root.classList),
                      n
                        .on("video:play", function(t) {
                          (o = t.slide), e.add(C);
                        })
                        .on("video:pause video:ended", function(t) {
                          t.slide === o && ((o = null), e.remove(C));
                        })
                        .on("destroy", function() {
                          e.remove(C);
                        });
                  },
                  destroy: function() {
                    r.forEach(function(t) {
                      t.destroy();
                    });
                  },
                };
              };
            },
          ]),
          (o.c = i),
          (o.d = function(t, e, n) {
            o.o(t, e) ||
              Object.defineProperty(t, e, { enumerable: !0, get: n });
          }),
          (o.r = function(t) {
            "undefined" != typeof Symbol &&
              Symbol.toStringTag &&
              Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
              Object.defineProperty(t, "__esModule", { value: !0 });
          }),
          (o.t = function(e, t) {
            if ((1 & t && (e = o(e)), 8 & t)) return e;
            if (4 & t && "object" == typeof e && e && e.__esModule) return e;
            var n = Object.create(null);
            if (
              (o.r(n),
              Object.defineProperty(n, "default", { enumerable: !0, value: e }),
              2 & t && "string" != typeof e)
            )
              for (var i in e)
                o.d(
                  n,
                  i,
                  function(t) {
                    return e[t];
                  }.bind(null, i)
                );
            return n;
          }),
          (o.n = function(t) {
            var e =
              t && t.__esModule
                ? function() {
                    return t.default;
                  }
                : function() {
                    return t;
                  };
            return o.d(e, "a", e), e;
          }),
          (o.o = function(t, e) {
            return Object.prototype.hasOwnProperty.call(t, e);
          }),
          (o.p = ""),
          o((o.s = 5))
        );
        function o(t) {
          if (i[t]) return i[t].exports;
          var e = (i[t] = { i: t, l: !1, exports: {} });
          return n[t].call(e.exports, e, e.exports, o), (e.l = !0), e.exports;
        }
        var n, i;
      }),
      (t.exports = i());
  },
  function(t, e, n) {
    var i;
    window,
      (i = function() {
        return (
          (i = {}),
          (o.m = n = [
            function(t, e, n) {
              "use strict";
              n.r(e);
              var o = "data-splide-hash";
              e.default = function(e, n) {
                function i(e) {
                  if (!(e = e.replace("#", ""))) return !1;
                  var t = n.Elements.getSlides(!1).filter(function(t) {
                    return t.slide.getAttribute(o) === e;
                  })[0];
                  return !!t && t.index;
                }
                return {
                  mount: function() {
                    (e.index = i(window.location.hash) || e.options.start),
                      e.on("moved", function(t) {
                        var e = n.Elements.getSlide(t).slide.getAttribute(o);
                        e
                          ? (window.location.hash = e)
                          : history
                          ? history.replaceState(null, null, " ")
                          : (window.location.hash = "");
                      }),
                      e.on(
                        "hashchange",
                        function() {
                          var t = i(window.location.hash);
                          !1 !== t && e.index !== t && e.go(t);
                        },
                        window
                      );
                  },
                };
              };
            },
          ]),
          (o.c = i),
          (o.d = function(t, e, n) {
            o.o(t, e) ||
              Object.defineProperty(t, e, { enumerable: !0, get: n });
          }),
          (o.r = function(t) {
            "undefined" != typeof Symbol &&
              Symbol.toStringTag &&
              Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
              Object.defineProperty(t, "__esModule", { value: !0 });
          }),
          (o.t = function(e, t) {
            if ((1 & t && (e = o(e)), 8 & t)) return e;
            if (4 & t && "object" == typeof e && e && e.__esModule) return e;
            var n = Object.create(null);
            if (
              (o.r(n),
              Object.defineProperty(n, "default", { enumerable: !0, value: e }),
              2 & t && "string" != typeof e)
            )
              for (var i in e)
                o.d(
                  n,
                  i,
                  function(t) {
                    return e[t];
                  }.bind(null, i)
                );
            return n;
          }),
          (o.n = function(t) {
            var e =
              t && t.__esModule
                ? function() {
                    return t.default;
                  }
                : function() {
                    return t;
                  };
            return o.d(e, "a", e), e;
          }),
          (o.o = function(t, e) {
            return Object.prototype.hasOwnProperty.call(t, e);
          }),
          (o.p = ""),
          o((o.s = 0))
        );
        function o(t) {
          if (i[t]) return i[t].exports;
          var e = (i[t] = { i: t, l: !1, exports: {} });
          return n[t].call(e.exports, e, e.exports, o), (e.l = !0), e.exports;
        }
        var n, i;
      }),
      (t.exports = i());
  },
  function(t, e, n) {
    var i;
    window,
      (i = function() {
        return (
          (i = {}),
          (o.m = n = [
            function(t, e, n) {
              "use strict";
              function c(e, n) {
                Object.keys(n).forEach(function(t) {
                  e.style[t] = n[t];
                });
              }
              function u(n, i) {
                Object.keys(n).some(function(t, e) {
                  return i(n[t], t, e);
                });
              }
              function p(t) {
                var e = typeof t;
                return "number" == e && 0 < t
                  ? parseFloat(t) + "px"
                  : "string" == e
                  ? t
                  : "";
              }
              n.r(e);
              var i = { rows: 1, cols: 1, dimensions: !1, gap: {} };
              function o() {
                return (o =
                  Object.assign ||
                  function(t) {
                    for (var e = 1; e < arguments.length; e++) {
                      var n = arguments[e];
                      for (var i in n)
                        Object.prototype.hasOwnProperty.call(n, i) &&
                          (t[i] = n[i]);
                    }
                    return t;
                  }).apply(this, arguments);
              }
              var v = "data-splide-grid-width";
              e.default = function(d, e) {
                var s,
                  f,
                  h = e.Elements,
                  t = d.classes.slide.split(" ")[0],
                  a = t ? t + "__row" : "",
                  l = t ? t + "--col" : "";
                return {
                  mount: function() {
                    var e = this;
                    this.initOptions(),
                      (f = h.slides),
                      (s = d.options.grid),
                      this.shouldActivate() && this.init(),
                      d.on("updated", function() {
                        (s = d.options.grid),
                          e.shouldActivate() ? e.init() : e.destroy();
                      }),
                      d.options.accessibility &&
                        (d.on("visible", function(t) {
                          return e.updateA11y(t, !0);
                        }),
                        d.on("hidden", function(t) {
                          return e.updateA11y(t, !1);
                        }));
                  },
                  destroy: function() {
                    var e, n;
                    f &&
                      ((e = h.list),
                      (n = document.createDocumentFragment()),
                      f.forEach(function(t) {
                        n.appendChild(t);
                      }),
                      (e.innerHTML = ""),
                      f.forEach(function(t) {
                        e.appendChild(t),
                          t.classList.remove(l),
                          t.removeAttribute("style");
                      }),
                      (h.slides = f),
                      this.toggleRootClassModifiers("grid", !0),
                      d.refresh());
                  },
                  initOptions: function() {
                    "object" != typeof d.options.grid && (d.options.grid = {}),
                      (d.options.grid = o({}, i, {}, d.options.grid));
                  },
                  shouldActivate: function() {
                    var t = d.options.grid,
                      e = t.rows,
                      n = t.cols,
                      i = t.dimensions;
                    return 1 < e || 1 < n || i;
                  },
                  init: function() {
                    f.length &&
                      ((h.slides = this.buildGrid()),
                      f.forEach(function(t) {
                        t.removeAttribute("id");
                      }),
                      d.refresh(),
                      this.toggleRootClassModifiers("grid"),
                      this.setStyles());
                  },
                  toggleRootClassModifiers: function(t, e) {
                    void 0 === e && (e = !1);
                    var n = d.classes.root.split(" ")[0];
                    n &&
                      (Array.isArray(t) || (t = [t]),
                      t.forEach(function(t) {
                        d.root.classList[e ? "remove" : "add"](n + "--" + t);
                      }));
                  },
                  setStyles: function() {
                    var r = this;
                    h.each(function(t) {
                      var o = e.Layout.margin;
                      u(t.slide.querySelectorAll("." + l), function(t) {
                        var e,
                          n = s.gap.col,
                          i = void 0 === n ? 0 : n;
                        c(
                          t,
                          (((e = { width: t.getAttribute(v), height: "100%" })[
                            o
                          ] = "" + p(i)),
                          e)
                        ),
                          t.removeAttribute(v),
                          r.cover(t);
                      }),
                        c(t.slide.lastElementChild, { marginBottom: "0" }),
                        u(t.slide.children, function(t) {
                          var e;
                          c(t.lastElementChild, (((e = {})[o] = "0"), e));
                        });
                    });
                  },
                  cover: function(t) {
                    var e;
                    !d.options.cover ||
                      ((e = t.querySelector("img")) &&
                        e.src &&
                        (c(t, {
                          background:
                            'center/cover no-repeat url("' + e.src + '")',
                        }),
                        c(e, { display: "none" })));
                  },
                  buildGrid: function() {
                    for (
                      var t, e, n, i = [], o = 0, r = 0, s = 0;
                      s < f.length;
                      s++
                    ) {
                      var a = this.getDimension(s),
                        l = a.rows,
                        c = a.cols,
                        u = f[s];
                      0 === r &&
                        (0 === o &&
                          ((t = document.createElement(
                            u.tagName
                          )).classList.add(d.classes.slide),
                          i.push(t)),
                        (e = this.createRow(l)),
                        t.appendChild(e)),
                        (n = this.createCol(c, u)),
                        e.appendChild(n),
                        c <= ++r && (o++, (r = 0)),
                        l <= o && (r = o = 0);
                    }
                    return (
                      (h.list.innerHTML = ""),
                      i.forEach(function(t) {
                        h.list.appendChild(t);
                      }),
                      i
                    );
                  },
                  getDimension: function(e) {
                    var n = s.rows,
                      i = s.cols,
                      o = 0;
                    return (
                      s.dimensions &&
                        u(s.dimensions, function(t) {
                          return (
                            (n = t[0] || 1), (i = t[1] || 1), e < (o += n * i)
                          );
                        }),
                      { rows: n, cols: i }
                    );
                  },
                  createRow: function(t) {
                    var e = s.gap.row,
                      n = void 0 === e ? 0 : e,
                      i = f[0],
                      o = document.createElement(
                        "li" === i.tagName.toLowerCase() ? "ul" : "div"
                      );
                    o.classList.add(a);
                    var r = "calc( " + 100 / t + "%";
                    return (
                      n && (r += " - " + p(n) + " * " + (t - 1) / t + " )"),
                      c(o, {
                        height: r,
                        display: "flex",
                        margin: "0 0 " + p(n) + " 0",
                        padding: "0",
                      }),
                      o
                    );
                  },
                  createCol: function(t, e) {
                    var n = s.gap.col,
                      i = void 0 === n ? 0 : n,
                      o = "calc( " + 100 / t + "%";
                    return (
                      i && (o += " - " + p(i) + " * " + (t - 1) / t + " )"),
                      e.classList.add(l),
                      e.setAttribute(v, o),
                      e
                    );
                  },
                  updateA11y: function(t, e) {
                    u(t.slide.querySelectorAll("." + l), function(t) {
                      t.setAttribute("tabindex", e ? 0 : -1);
                    });
                  },
                  get rowClass() {
                    return a;
                  },
                  get colClass() {
                    return l;
                  },
                };
              };
            },
          ]),
          (o.c = i),
          (o.d = function(t, e, n) {
            o.o(t, e) ||
              Object.defineProperty(t, e, { enumerable: !0, get: n });
          }),
          (o.r = function(t) {
            "undefined" != typeof Symbol &&
              Symbol.toStringTag &&
              Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }),
              Object.defineProperty(t, "__esModule", { value: !0 });
          }),
          (o.t = function(e, t) {
            if ((1 & t && (e = o(e)), 8 & t)) return e;
            if (4 & t && "object" == typeof e && e && e.__esModule) return e;
            var n = Object.create(null);
            if (
              (o.r(n),
              Object.defineProperty(n, "default", { enumerable: !0, value: e }),
              2 & t && "string" != typeof e)
            )
              for (var i in e)
                o.d(
                  n,
                  i,
                  function(t) {
                    return e[t];
                  }.bind(null, i)
                );
            return n;
          }),
          (o.n = function(t) {
            var e =
              t && t.__esModule
                ? function() {
                    return t.default;
                  }
                : function() {
                    return t;
                  };
            return o.d(e, "a", e), e;
          }),
          (o.o = function(t, e) {
            return Object.prototype.hasOwnProperty.call(t, e);
          }),
          (o.p = ""),
          o((o.s = 0))
        );
        function o(t) {
          if (i[t]) return i[t].exports;
          var e = (i[t] = { i: t, l: !1, exports: {} });
          return n[t].call(e.exports, e, e.exports, o), (e.l = !0), e.exports;
        }
        var n, i;
      }),
      (t.exports = i());
  },
  function(t, e, n) {
    "use strict";
    n.r(e);
    var i = n(0),
      a = n.n(i),
      o = n(1),
      r = n.n(o),
      s = n(2),
      l = n.n(s),
      c = n(3),
      u = n.n(c),
      d = {
        arrows: "splide__arrows p-splide__arrows",
        arrow: "splide__arrow p-splide__arrow",
        prev: "splide__arrow--prev p-splide__arrow--prev",
        next: "splide__arrow--next p-splide__arrow--next",
        pagination: "splide__pagination p-splide__pagination",
        page: "splide__pagination__page p-splide__pagination__page",
      };
    function f(t, s) {
      void 0 === s && (s = {}),
        document.addEventListener("DOMContentLoaded", function() {
          var e,
            n,
            i,
            o = document.querySelectorAll(t),
            r = Object.keys(o);
          r.length &&
            ((e = {
              gap: "1.5rem",
              rewindSpeed: 800,
              keyboard: !1,
              waitForTransition: !1,
              breakpoints: { 600: { gap: "0.5rem" } },
              classes: d,
            }),
            (n = -1),
            (i = 3),
            (function t() {
              setTimeout(function() {
                ++n < r.length &&
                  ((function(i) {
                    if (!i) {
                      return false;
                    }
                    var t = i.root.nextElementSibling;
                    if (t && t.classList.contains("js-controls")) {
                      var e = t.getElementsByClassName("js-controls-input");
                      if (e.length)
                        for (var n = 0; n < e.length; n++)
                          !(function(t) {
                            var n = e[t];
                            n.addEventListener("change", function() {
                              var t,
                                e = n.value;
                              "true" === e
                                ? (e = !0)
                                : "false" === e
                                ? (e = !1)
                                : isNaN(e) || (e = parseInt(e)),
                                (i.options = (((t = {})[n.name] = e), t));
                            });
                          })(n);
                    }
                  })(new a.a(o[r[n]], e).mount(s)),
                  t());
              }, i);
            })());
        });
    }
    function h(n, i) {
      Object.keys(n).some(function(t, e) {
        return i(n[t], t, e);
      });
    }
    function p(i, o, r) {
      void 0 === r && (r = null);
      var s,
        a,
        l,
        c = window.requestAnimationFrame;
      c(function t(e) {
        var n;
        (n = (a = e - (s = s || e)) / o),
          (l = --n * n * n + 1),
          o <= a ? (l = 1) : c(t),
          i(l),
          1 === l && r && r();
      });
    }
    function v() {
      return (v =
        Object.assign ||
        function(t) {
          for (var e = 1; e < arguments.length; e++) {
            var n = arguments[e];
            for (var i in n)
              Object.prototype.hasOwnProperty.call(n, i) && (t[i] = n[i]);
          }
          return t;
        }).apply(this, arguments);
    }
    document.addEventListener("DOMContentLoaded", function() {
      var e,
        n = document.querySelector(".js-header-splide");
      n &&
        ((e = {
          type: "loop",
          perPage: 5,
          gap: "4rem",
          perMove: 1,
          start: 4,
          focus: "center",
          rewind: !0,
          padding: { left: "7rem", right: "7rem" },
          autoplay: !0,
          pauseOnHover: !1,
          pauseOnFocus: !1,
          updateOnMove: !0,
          keyboard: !1,
          classes: {
            pagination: "splide__pagination p-header-splide__pagination",
            page: "splide__pagination__page p-header-splide__pagination__page",
          },
          breakpoints: {
            2280: {
              perPage: 4,
              gap: "4rem",
              padding: { left: "7rem", right: "7rem" },
            },
            1728: {
              perPage: 3,
              gap: "4rem",
              padding: { left: "7rem", right: "7rem" },
            },
            1240: {
              perPage: 2,
              gap: "3rem",
              padding: { left: "7rem", right: "7rem" },
            },
            800: {
              perPage: 1,
              gap: "3rem",
              padding: { left: "7rem", right: "7rem" },
            },
            600: {
              perPage: 1,
              gap: "2rem",
              padding: { left: "4rem", right: "4rem" },
            },
          },
        }),
        setTimeout(function() {
          var t = new a.a(n, e);
          t.on("mounted", function() {
            t.root.classList.add("is-active"),
              t.Components.Elements.slides.forEach(function(t, e) {
                t.style.animationDelay = 80 * e + "ms";
              });
          }),
            t.mount();
        }));
    }),
      document.addEventListener("DOMContentLoaded", function() {
        var e,
          n = document.querySelector(".js-splide-primary"),
          i = document.querySelector(".js-splide-secondary");
        n &&
          i &&
          ((e = { gap: "2rem", classes: d, keyboard: "focused" }),
          setTimeout(function() {
            var t = new a.a(i, e).mount();
            new a.a(n, e).sync(t).mount();
          }));
      }),
      document.addEventListener("DOMContentLoaded", function() {
        var t,
          n,
          i,
          o = document.querySelector(".js-splide-add-remove");
        o &&
          ((t = {
            gap: "1.5rem",
            keyboard: !1,
            breakpoints: { 600: { gap: "0.5rem" } },
            classes: d,
          }),
          (n = document.querySelector(".js-splide-add-button")),
          (i = document.querySelector(".js-splide-remove-button")),
          setTimeout(function() {
            var e = new a.a(o, t).mount();
            n.addEventListener("click", function() {
              var t = (t = e.length + 1) < 10 ? "0" + t : t.toString();
              e.add(
                '<li class="splide__slide p-splide__slide"><span class="p-splide__slide__number">' +
                  t +
                  "</span></li>"
              );
            }),
              i.addEventListener("click", function() {
                e.remove(e.length - 1);
              }),
              e.on("updated", function() {
                (i.disabled = !e.length), (n.disabled = 30 <= e.length);
              });
          }));
      }),
      f(".js-splide", {}),
      f(".js-splide-video", { Video: r.a }),
      f(".js-splide-url-hash", { URLHash: l.a }),
      f(".js-splide-grid", { Grid: u.a, Video: r.a });
    var m = (function() {
        function t(t, e, n) {
          void 0 === n && (n = {});
          var i, o;
          (this.elm = t),
            (this.button = e),
            (this.options = v(
              {},
              { duration: 400, collapseClass: "is-collapsed" },
              n
            )),
            (this.transitioning = !1),
            (i = this.elm),
            (o = { height: "0px", overflowY: "hidden" }),
            Object.keys(o).forEach(function(t) {
              i.style[t] = o[t];
            }),
            this.button.classList.add(this.options.collapseClass),
            this.bind();
        }
        var e = t.prototype;
        return (
          (e.bind = function() {
            this.button.addEventListener("click", this.toggle.bind(this));
          }),
          (e.collapse = function() {
            var e,
              n = this;
            this.transitioning ||
              ((this.transitioning = !0),
              (e = this.elm.scrollHeight),
              p(
                function(t) {
                  n.elm.style.height = e * (1 - t) + "px";
                },
                this.options.duration,
                function() {
                  n.button.classList.add(n.options.collapseClass),
                    (n.transitioning = !1);
                }
              ));
          }),
          (e.show = function() {
            var e,
              n = this;
            this.transitioning ||
              ((this.transitioning = !0),
              (e = this.elm.scrollHeight),
              p(
                function(t) {
                  n.elm.style.height = e * t + "px";
                },
                this.options.duration,
                function() {
                  (n.elm.style.height = ""),
                    n.button.classList.remove(n.options.collapseClass),
                    (n.transitioning = !1);
                }
              ));
          }),
          (e.toggle = function() {
            0 < this.elm.clientHeight ? this.collapse() : this.show();
          }),
          t
        );
      })(),
      g = ".js-collapse-button";
    /*!
     * perfect-scrollbar v1.5.0
     * Copyright 2020 Hyunje Jun, MDBootstrap and Contributors
     * Licensed under MIT
     */
    function y(t) {
      return getComputedStyle(t);
    }
    function b(t, e) {
      for (var n in e) {
        var i = e[n];
        "number" == typeof i && (i += "px"), (t.style[n] = i);
      }
      return t;
    }
    function w(t) {
      var e = document.createElement("div");
      return (e.className = t), e;
    }
    document.addEventListener("DOMContentLoaded", function() {
      h(document.getElementsByClassName("js-collapse"), function(t) {
        var e;
        t.nextElementSibling && (e = t.nextElementSibling.querySelector(g)),
          !e &&
            t.previousElementSibling &&
            (e = t.previousElementSibling.querySelector(g)),
          e && new m(t, e);
      });
    });
    var E =
      "undefined" != typeof Element &&
      (Element.prototype.matches ||
        Element.prototype.webkitMatchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector);
    function _(t, e) {
      if (!E) throw new Error("No element matching method supported");
      return E.call(t, e);
    }
    function P(t) {
      t.remove ? t.remove() : t.parentNode && t.parentNode.removeChild(t);
    }
    function k(t, e) {
      return Array.prototype.filter.call(t.children, function(t) {
        return _(t, e);
      });
    }
    var S = {
        main: "ps",
        rtl: "ps__rtl",
        element: {
          thumb: function(t) {
            return "ps__thumb-" + t;
          },
          rail: function(t) {
            return "ps__rail-" + t;
          },
          consuming: "ps__child--consume",
        },
        state: {
          focus: "ps--focus",
          clicking: "ps--clicking",
          active: function(t) {
            return "ps--active-" + t;
          },
          scrolling: function(t) {
            return "ps--scrolling-" + t;
          },
        },
      },
      T = { x: null, y: null };
    function x(t, e) {
      var n = t.element.classList,
        i = S.state.scrolling(e);
      n.contains(i) ? clearTimeout(T[e]) : n.add(i);
    }
    function O(t, e) {
      T[e] = setTimeout(function() {
        return t.isAlive && t.element.classList.remove(S.state.scrolling(e));
      }, t.settings.scrollingThreshold);
    }
    function L(t) {
      (this.element = t), (this.handlers = {});
    }
    var j = { isEmpty: { configurable: !0 } };
    (L.prototype.bind = function(t, e) {
      void 0 === this.handlers[t] && (this.handlers[t] = []),
        this.handlers[t].push(e),
        this.element.addEventListener(t, e, !1);
    }),
      (L.prototype.unbind = function(e, n) {
        var i = this;
        this.handlers[e] = this.handlers[e].filter(function(t) {
          return (
            !(!n || t === n) || (i.element.removeEventListener(e, t, !1), !1)
          );
        });
      }),
      (L.prototype.unbindAll = function() {
        for (var t in this.handlers) this.unbind(t);
      }),
      (j.isEmpty.get = function() {
        var e = this;
        return Object.keys(this.handlers).every(function(t) {
          return 0 === e.handlers[t].length;
        });
      }),
      Object.defineProperties(L.prototype, j);
    function M() {
      this.eventElements = [];
    }
    function R(t) {
      if ("function" == typeof window.CustomEvent) return new CustomEvent(t);
      var e = document.createEvent("CustomEvent");
      return e.initCustomEvent(t, !1, !1, void 0), e;
    }
    function C(t, e, n, i, o) {
      var r;
      if ((void 0 === i && (i = !0), void 0 === o && (o = !1), "top" === e))
        r = [
          "contentHeight",
          "containerHeight",
          "scrollTop",
          "y",
          "up",
          "down",
        ];
      else {
        if ("left" !== e) throw new Error("A proper axis should be provided");
        r = [
          "contentWidth",
          "containerWidth",
          "scrollLeft",
          "x",
          "left",
          "right",
        ];
      }
      !(function(t, e, n, i, o) {
        var r = n[0],
          s = n[1],
          a = n[2],
          l = n[3],
          c = n[4],
          u = n[5];
        void 0 === i && (i = !0);
        void 0 === o && (o = !1);
        var d = t.element;
        (t.reach[l] = null), d[a] < 1 && (t.reach[l] = "start");
        d[a] > t[r] - t[s] - 1 && (t.reach[l] = "end");
        e &&
          (d.dispatchEvent(R("ps-scroll-" + l)),
          e < 0
            ? d.dispatchEvent(R("ps-scroll-" + c))
            : 0 < e && d.dispatchEvent(R("ps-scroll-" + u)),
          i &&
            (function(t, e) {
              x(t, e), O(t, e);
            })(t, l));
        t.reach[l] &&
          (e || o) &&
          d.dispatchEvent(R("ps-" + l + "-reach-" + t.reach[l]));
      })(t, n, r, i, o);
    }
    function A(t) {
      return parseInt(t, 10) || 0;
    }
    (M.prototype.eventElement = function(e) {
      var t = this.eventElements.filter(function(t) {
        return t.element === e;
      })[0];
      return t || ((t = new L(e)), this.eventElements.push(t)), t;
    }),
      (M.prototype.bind = function(t, e, n) {
        this.eventElement(t).bind(e, n);
      }),
      (M.prototype.unbind = function(t, e, n) {
        var i = this.eventElement(t);
        i.unbind(e, n),
          i.isEmpty &&
            this.eventElements.splice(this.eventElements.indexOf(i), 1);
      }),
      (M.prototype.unbindAll = function() {
        this.eventElements.forEach(function(t) {
          return t.unbindAll();
        }),
          (this.eventElements = []);
      }),
      (M.prototype.once = function(t, e, n) {
        var i = this.eventElement(t),
          o = function(t) {
            i.unbind(e, o), n(t);
          };
        i.bind(e, o);
      });
    var Y = {
      isWebKit:
        "undefined" != typeof document &&
        "WebkitAppearance" in document.documentElement.style,
      supportsTouch:
        "undefined" != typeof window &&
        ("ontouchstart" in window ||
          ("maxTouchPoints" in window.navigator &&
            0 < window.navigator.maxTouchPoints) ||
          (window.DocumentTouch && document instanceof window.DocumentTouch)),
      supportsIePointer:
        "undefined" != typeof navigator && navigator.msMaxTouchPoints,
      isChrome:
        "undefined" != typeof navigator &&
        /Chrome/i.test(navigator && navigator.userAgent),
    };
    function W(t) {
      var e = t.element,
        n = Math.floor(e.scrollTop),
        i = e.getBoundingClientRect();
      (t.containerWidth = Math.ceil(i.width)),
        (t.containerHeight = Math.ceil(i.height)),
        (t.contentWidth = e.scrollWidth),
        (t.contentHeight = e.scrollHeight),
        e.contains(t.scrollbarXRail) ||
          (k(e, S.element.rail("x")).forEach(P),
          e.appendChild(t.scrollbarXRail)),
        e.contains(t.scrollbarYRail) ||
          (k(e, S.element.rail("y")).forEach(P),
          e.appendChild(t.scrollbarYRail)),
        !t.settings.suppressScrollX &&
        t.containerWidth + t.settings.scrollXMarginOffset < t.contentWidth
          ? ((t.scrollbarXActive = !0),
            (t.railXWidth = t.containerWidth - t.railXMarginWidth),
            (t.railXRatio = t.containerWidth / t.railXWidth),
            (t.scrollbarXWidth = I(
              t,
              A((t.railXWidth * t.containerWidth) / t.contentWidth)
            )),
            (t.scrollbarXLeft = A(
              ((t.negativeScrollAdjustment + e.scrollLeft) *
                (t.railXWidth - t.scrollbarXWidth)) /
                (t.contentWidth - t.containerWidth)
            )))
          : (t.scrollbarXActive = !1),
        !t.settings.suppressScrollY &&
        t.containerHeight + t.settings.scrollYMarginOffset < t.contentHeight
          ? ((t.scrollbarYActive = !0),
            (t.railYHeight = t.containerHeight - t.railYMarginHeight),
            (t.railYRatio = t.containerHeight / t.railYHeight),
            (t.scrollbarYHeight = I(
              t,
              A((t.railYHeight * t.containerHeight) / t.contentHeight)
            )),
            (t.scrollbarYTop = A(
              (n * (t.railYHeight - t.scrollbarYHeight)) /
                (t.contentHeight - t.containerHeight)
            )))
          : (t.scrollbarYActive = !1),
        t.scrollbarXLeft >= t.railXWidth - t.scrollbarXWidth &&
          (t.scrollbarXLeft = t.railXWidth - t.scrollbarXWidth),
        t.scrollbarYTop >= t.railYHeight - t.scrollbarYHeight &&
          (t.scrollbarYTop = t.railYHeight - t.scrollbarYHeight),
        (function(t, e) {
          var n = { width: e.railXWidth },
            i = Math.floor(t.scrollTop);
          e.isRtl
            ? (n.left =
                e.negativeScrollAdjustment +
                t.scrollLeft +
                e.containerWidth -
                e.contentWidth)
            : (n.left = t.scrollLeft);
          e.isScrollbarXUsingBottom
            ? (n.bottom = e.scrollbarXBottom - i)
            : (n.top = e.scrollbarXTop + i);
          b(e.scrollbarXRail, n);
          var o = { top: i, height: e.railYHeight };
          e.isScrollbarYUsingRight
            ? e.isRtl
              ? (o.right =
                  e.contentWidth -
                  (e.negativeScrollAdjustment + t.scrollLeft) -
                  e.scrollbarYRight -
                  e.scrollbarYOuterWidth -
                  9)
              : (o.right = e.scrollbarYRight - t.scrollLeft)
            : e.isRtl
            ? (o.left =
                e.negativeScrollAdjustment +
                t.scrollLeft +
                2 * e.containerWidth -
                e.contentWidth -
                e.scrollbarYLeft -
                e.scrollbarYOuterWidth)
            : (o.left = e.scrollbarYLeft + t.scrollLeft);
          b(e.scrollbarYRail, o),
            b(e.scrollbarX, {
              left: e.scrollbarXLeft,
              width: e.scrollbarXWidth - e.railBorderXWidth,
            }),
            b(e.scrollbarY, {
              top: e.scrollbarYTop,
              height: e.scrollbarYHeight - e.railBorderYWidth,
            });
        })(e, t),
        t.scrollbarXActive
          ? e.classList.add(S.state.active("x"))
          : (e.classList.remove(S.state.active("x")),
            (t.scrollbarXWidth = 0),
            (t.scrollbarXLeft = 0),
            (e.scrollLeft = !0 === t.isRtl ? t.contentWidth : 0)),
        t.scrollbarYActive
          ? e.classList.add(S.state.active("y"))
          : (e.classList.remove(S.state.active("y")),
            (t.scrollbarYHeight = 0),
            (t.scrollbarYTop = 0),
            (e.scrollTop = 0));
    }
    function I(t, e) {
      return (
        t.settings.minScrollbarLength &&
          (e = Math.max(e, t.settings.minScrollbarLength)),
        t.settings.maxScrollbarLength &&
          (e = Math.min(e, t.settings.maxScrollbarLength)),
        e
      );
    }
    function X(n, t) {
      var i = t[0],
        o = t[1],
        r = t[2],
        s = t[3],
        e = t[4],
        a = t[5],
        l = t[6],
        c = t[7],
        u = t[8],
        d = n.element,
        f = null,
        h = null,
        p = null;
      function v(t) {
        t.touches && t.touches[0] && (t[r] = t.touches[0].pageY),
          (d[l] = f + p * (t[r] - h)),
          x(n, c),
          W(n),
          t.stopPropagation(),
          t.preventDefault();
      }
      function m() {
        O(n, c),
          n[u].classList.remove(S.state.clicking),
          n.event.unbind(n.ownerDocument, "mousemove", v);
      }
      function g(t, e) {
        (f = d[l]),
          e && t.touches && (t[r] = t.touches[0].pageY),
          (h = t[r]),
          (p = (n[o] - n[i]) / (n[s] - n[a])),
          e
            ? n.event.bind(n.ownerDocument, "touchmove", v)
            : (n.event.bind(n.ownerDocument, "mousemove", v),
              n.event.once(n.ownerDocument, "mouseup", m),
              t.preventDefault()),
          n[u].classList.add(S.state.clicking),
          t.stopPropagation();
      }
      n.event.bind(n[e], "mousedown", function(t) {
        g(t);
      }),
        n.event.bind(n[e], "touchstart", function(t) {
          g(t, !0);
        });
    }
    function H(t, e) {
      var n,
        i,
        o = this;
      if (
        (void 0 === e && (e = {}),
        "string" == typeof t && (t = document.querySelector(t)),
        !t || !t.nodeName)
      )
        throw new Error(
          "no element is specified to initialize PerfectScrollbar"
        );
      for (var r in ((this.element = t).classList.add(S.main),
      (this.settings = {
        handlers: ["click-rail", "drag-thumb", "keyboard", "wheel", "touch"],
        maxScrollbarLength: null,
        minScrollbarLength: null,
        scrollingThreshold: 1e3,
        scrollXMarginOffset: 0,
        scrollYMarginOffset: 0,
        suppressScrollX: !1,
        suppressScrollY: !1,
        swipeEasing: !0,
        useBothWheelAxes: !1,
        wheelPropagation: !0,
        wheelSpeed: 1,
      }),
      e))
        this.settings[r] = e[r];
      function s() {
        return t.classList.add(S.state.focus);
      }
      function a() {
        return t.classList.remove(S.state.focus);
      }
      (this.containerWidth = null),
        (this.containerHeight = null),
        (this.contentWidth = null),
        (this.contentHeight = null),
        (this.isRtl = "rtl" === y(t).direction),
        !0 === this.isRtl && t.classList.add(S.rtl),
        (this.isNegativeScroll =
          ((i = t.scrollLeft),
          (t.scrollLeft = -1),
          (n = t.scrollLeft < 0),
          (t.scrollLeft = i),
          n)),
        (this.negativeScrollAdjustment = this.isNegativeScroll
          ? t.scrollWidth - t.clientWidth
          : 0),
        (this.event = new M()),
        (this.ownerDocument = t.ownerDocument || document),
        (this.scrollbarXRail = w(S.element.rail("x"))),
        t.appendChild(this.scrollbarXRail),
        (this.scrollbarX = w(S.element.thumb("x"))),
        this.scrollbarXRail.appendChild(this.scrollbarX),
        this.scrollbarX.setAttribute("tabindex", 0),
        this.event.bind(this.scrollbarX, "focus", s),
        this.event.bind(this.scrollbarX, "blur", a),
        (this.scrollbarXActive = null),
        (this.scrollbarXWidth = null),
        (this.scrollbarXLeft = null);
      var l = y(this.scrollbarXRail);
      (this.scrollbarXBottom = parseInt(l.bottom, 10)),
        isNaN(this.scrollbarXBottom)
          ? ((this.isScrollbarXUsingBottom = !1),
            (this.scrollbarXTop = A(l.top)))
          : (this.isScrollbarXUsingBottom = !0),
        (this.railBorderXWidth = A(l.borderLeftWidth) + A(l.borderRightWidth)),
        b(this.scrollbarXRail, { display: "block" }),
        (this.railXMarginWidth = A(l.marginLeft) + A(l.marginRight)),
        b(this.scrollbarXRail, { display: "" }),
        (this.railXWidth = null),
        (this.railXRatio = null),
        (this.scrollbarYRail = w(S.element.rail("y"))),
        t.appendChild(this.scrollbarYRail),
        (this.scrollbarY = w(S.element.thumb("y"))),
        this.scrollbarYRail.appendChild(this.scrollbarY),
        this.scrollbarY.setAttribute("tabindex", 0),
        this.event.bind(this.scrollbarY, "focus", s),
        this.event.bind(this.scrollbarY, "blur", a),
        (this.scrollbarYActive = null),
        (this.scrollbarYHeight = null),
        (this.scrollbarYTop = null);
      var c,
        u,
        d = y(this.scrollbarYRail);
      (this.scrollbarYRight = parseInt(d.right, 10)),
        isNaN(this.scrollbarYRight)
          ? ((this.isScrollbarYUsingRight = !1),
            (this.scrollbarYLeft = A(d.left)))
          : (this.isScrollbarYUsingRight = !0),
        (this.scrollbarYOuterWidth = this.isRtl
          ? ((c = this.scrollbarY),
            A((u = y(c)).width) +
              A(u.paddingLeft) +
              A(u.paddingRight) +
              A(u.borderLeftWidth) +
              A(u.borderRightWidth))
          : null),
        (this.railBorderYWidth = A(d.borderTopWidth) + A(d.borderBottomWidth)),
        b(this.scrollbarYRail, { display: "block" }),
        (this.railYMarginHeight = A(d.marginTop) + A(d.marginBottom)),
        b(this.scrollbarYRail, { display: "" }),
        (this.railYHeight = null),
        (this.railYRatio = null),
        (this.reach = {
          x:
            t.scrollLeft <= 0
              ? "start"
              : t.scrollLeft >= this.contentWidth - this.containerWidth
              ? "end"
              : null,
          y:
            t.scrollTop <= 0
              ? "start"
              : t.scrollTop >= this.contentHeight - this.containerHeight
              ? "end"
              : null,
        }),
        (this.isAlive = !0),
        this.settings.handlers.forEach(function(t) {
          return D[t](o);
        }),
        (this.lastScrollTop = Math.floor(t.scrollTop)),
        (this.lastScrollLeft = t.scrollLeft),
        this.event.bind(this.element, "scroll", function(t) {
          return o.onScroll(t);
        }),
        W(this);
    }
    var D = {
      "click-rail": function(n) {
        n.element,
          n.event.bind(n.scrollbarY, "mousedown", function(t) {
            return t.stopPropagation();
          }),
          n.event.bind(n.scrollbarYRail, "mousedown", function(t) {
            var e =
              t.pageY -
                window.pageYOffset -
                n.scrollbarYRail.getBoundingClientRect().top >
              n.scrollbarYTop
                ? 1
                : -1;
            (n.element.scrollTop += e * n.containerHeight),
              W(n),
              t.stopPropagation();
          }),
          n.event.bind(n.scrollbarX, "mousedown", function(t) {
            return t.stopPropagation();
          }),
          n.event.bind(n.scrollbarXRail, "mousedown", function(t) {
            var e =
              t.pageX -
                window.pageXOffset -
                n.scrollbarXRail.getBoundingClientRect().left >
              n.scrollbarXLeft
                ? 1
                : -1;
            (n.element.scrollLeft += e * n.containerWidth),
              W(n),
              t.stopPropagation();
          });
      },
      "drag-thumb": function(t) {
        X(t, [
          "containerWidth",
          "contentWidth",
          "pageX",
          "railXWidth",
          "scrollbarX",
          "scrollbarXWidth",
          "scrollLeft",
          "x",
          "scrollbarXRail",
        ]),
          X(t, [
            "containerHeight",
            "contentHeight",
            "pageY",
            "railYHeight",
            "scrollbarY",
            "scrollbarYHeight",
            "scrollTop",
            "y",
            "scrollbarYRail",
          ]);
      },
      keyboard: function(r) {
        var s = r.element;
        r.event.bind(r.ownerDocument, "keydown", function(t) {
          if (
            !(
              (t.isDefaultPrevented && t.isDefaultPrevented()) ||
              t.defaultPrevented
            ) &&
            (_(s, ":hover") ||
              _(r.scrollbarX, ":focus") ||
              _(r.scrollbarY, ":focus"))
          ) {
            var e,
              n = document.activeElement
                ? document.activeElement
                : r.ownerDocument.activeElement;
            if (n) {
              if ("IFRAME" === n.tagName) n = n.contentDocument.activeElement;
              else for (; n.shadowRoot; ) n = n.shadowRoot.activeElement;
              if (
                _((e = n), "input,[contenteditable]") ||
                _(e, "select,[contenteditable]") ||
                _(e, "textarea,[contenteditable]") ||
                _(e, "button,[contenteditable]")
              )
                return;
            }
            var i = 0,
              o = 0;
            switch (t.which) {
              case 37:
                i = t.metaKey
                  ? -r.contentWidth
                  : t.altKey
                  ? -r.containerWidth
                  : -30;
                break;
              case 38:
                o = t.metaKey
                  ? r.contentHeight
                  : t.altKey
                  ? r.containerHeight
                  : 30;
                break;
              case 39:
                i = t.metaKey
                  ? r.contentWidth
                  : t.altKey
                  ? r.containerWidth
                  : 30;
                break;
              case 40:
                o = t.metaKey
                  ? -r.contentHeight
                  : t.altKey
                  ? -r.containerHeight
                  : -30;
                break;
              case 32:
                o = t.shiftKey ? r.containerHeight : -r.containerHeight;
                break;
              case 33:
                o = r.containerHeight;
                break;
              case 34:
                o = -r.containerHeight;
                break;
              case 36:
                o = r.contentHeight;
                break;
              case 35:
                o = -r.contentHeight;
                break;
              default:
                return;
            }
            (r.settings.suppressScrollX && 0 !== i) ||
              (r.settings.suppressScrollY && 0 !== o) ||
              ((s.scrollTop -= o),
              (s.scrollLeft += i),
              W(r),
              (function(t, e) {
                var n = Math.floor(s.scrollTop);
                if (0 === t) {
                  if (!r.scrollbarYActive) return;
                  if (
                    (0 === n && 0 < e) ||
                    (n >= r.contentHeight - r.containerHeight && e < 0)
                  )
                    return !r.settings.wheelPropagation;
                }
                var i = s.scrollLeft;
                if (0 === e) {
                  if (!r.scrollbarXActive) return;
                  if (
                    (0 === i && t < 0) ||
                    (i >= r.contentWidth - r.containerWidth && 0 < t)
                  )
                    return !r.settings.wheelPropagation;
                }
                return 1;
              })(i, o) && t.preventDefault());
          }
        });
      },
      wheel: function(v) {
        var m = v.element;
        function t(t) {
          var e,
            n,
            i,
            o,
            r,
            s,
            a,
            l,
            c,
            u,
            d,
            f =
              ((n = (e = t).deltaX),
              (i = -1 * e.deltaY),
              (void 0 !== n && void 0 !== i) ||
                ((n = (-1 * e.wheelDeltaX) / 6), (i = e.wheelDeltaY / 6)),
              e.deltaMode && 1 === e.deltaMode && ((n *= 10), (i *= 10)),
              n != n && i != i && ((n = 0), (i = e.wheelDelta)),
              e.shiftKey ? [-i, -n] : [n, i]),
            h = f[0],
            p = f[1];
          !(function(t, e, n) {
            if (!Y.isWebKit && m.querySelector("select:focus")) return 1;
            if (m.contains(t))
              for (var i = t; i && i !== m; ) {
                if (i.classList.contains(S.element.consuming)) return 1;
                var o = y(i);
                if (n && o.overflowY.match(/(scroll|auto)/)) {
                  var r = i.scrollHeight - i.clientHeight;
                  if (
                    0 < r &&
                    ((0 < i.scrollTop && n < 0) || (i.scrollTop < r && 0 < n))
                  )
                    return 1;
                }
                if (e && o.overflowX.match(/(scroll|auto)/)) {
                  var s = i.scrollWidth - i.clientWidth;
                  if (
                    0 < s &&
                    ((0 < i.scrollLeft && e < 0) || (i.scrollLeft < s && 0 < e))
                  )
                    return 1;
                }
                i = i.parentNode;
              }
          })(t.target, h, p) &&
            ((o = !1),
            v.settings.useBothWheelAxes
              ? v.scrollbarYActive && !v.scrollbarXActive
                ? (p
                    ? (m.scrollTop -= p * v.settings.wheelSpeed)
                    : (m.scrollTop += h * v.settings.wheelSpeed),
                  (o = !0))
                : v.scrollbarXActive &&
                  !v.scrollbarYActive &&
                  (h
                    ? (m.scrollLeft += h * v.settings.wheelSpeed)
                    : (m.scrollLeft -= p * v.settings.wheelSpeed),
                  (o = !0))
              : ((m.scrollTop -= p * v.settings.wheelSpeed),
                (m.scrollLeft += h * v.settings.wheelSpeed)),
            W(v),
            (o =
              o ||
              ((r = h),
              (s = p),
              (a = Math.floor(m.scrollTop)),
              (l = 0 === m.scrollTop),
              (c = a + m.offsetHeight === m.scrollHeight),
              (u = 0 === m.scrollLeft),
              (d = m.scrollLeft + m.offsetWidth === m.scrollWidth),
              !(Math.abs(s) > Math.abs(r) ? l || c : u || d) ||
                !v.settings.wheelPropagation)) &&
              !t.ctrlKey &&
              (t.stopPropagation(), t.preventDefault()));
        }
        void 0 !== window.onwheel
          ? v.event.bind(m, "wheel", t)
          : void 0 !== window.onmousewheel && v.event.bind(m, "mousewheel", t);
      },
      touch: function(a) {
        var l, c, u, d, n;
        function f(t, e) {
          (l.scrollTop -= e), (l.scrollLeft -= t), W(a);
        }
        function h(t) {
          return t.targetTouches ? t.targetTouches[0] : t;
        }
        function p(t) {
          return (
            (!t.pointerType || "pen" !== t.pointerType || 0 !== t.buttons) &&
            ((t.targetTouches && 1 === t.targetTouches.length) ||
              !(
                !t.pointerType ||
                "mouse" === t.pointerType ||
                t.pointerType === t.MSPOINTER_TYPE_MOUSE
              ))
          );
        }
        function t(t) {
          var e;
          p(t) &&
            ((e = h(t)),
            (c.pageX = e.pageX),
            (c.pageY = e.pageY),
            (u = new Date().getTime()),
            null !== n && clearInterval(n));
        }
        function e(t) {
          if (p(t)) {
            var e = h(t),
              n = { pageX: e.pageX, pageY: e.pageY },
              i = n.pageX - c.pageX,
              o = n.pageY - c.pageY;
            if (
              (function(t, e, n) {
                if (l.contains(t))
                  for (var i = t; i && i !== l; ) {
                    if (i.classList.contains(S.element.consuming)) return 1;
                    var o = y(i);
                    if (n && o.overflowY.match(/(scroll|auto)/)) {
                      var r = i.scrollHeight - i.clientHeight;
                      if (
                        0 < r &&
                        ((0 < i.scrollTop && n < 0) ||
                          (i.scrollTop < r && 0 < n))
                      )
                        return 1;
                    }
                    if (e && o.overflowX.match(/(scroll|auto)/)) {
                      var s = i.scrollWidth - i.clientWidth;
                      if (
                        0 < s &&
                        ((0 < i.scrollLeft && e < 0) ||
                          (i.scrollLeft < s && 0 < e))
                      )
                        return 1;
                    }
                    i = i.parentNode;
                  }
              })(t.target, i, o)
            )
              return;
            f(i, o), (c = n);
            var r = new Date().getTime(),
              s = r - u;
            0 < s && ((d.x = i / s), (d.y = o / s), (u = r)),
              (function(t, e) {
                var n = Math.floor(l.scrollTop),
                  i = l.scrollLeft,
                  o = Math.abs(t),
                  r = Math.abs(e);
                if (o < r) {
                  if (
                    (e < 0 && n === a.contentHeight - a.containerHeight) ||
                    (0 < e && 0 === n)
                  )
                    return 0 === window.scrollY && 0 < e && Y.isChrome;
                } else if (
                  r < o &&
                  ((t < 0 && i === a.contentWidth - a.containerWidth) ||
                    (0 < t && 0 === i))
                )
                  return 1;
                return 1;
              })(i, o) && t.preventDefault();
          }
        }
        function i() {
          a.settings.swipeEasing &&
            (clearInterval(n),
            (n = setInterval(function() {
              a.isInitialized ||
              (!d.x && !d.y) ||
              (Math.abs(d.x) < 0.01 && Math.abs(d.y) < 0.01)
                ? clearInterval(n)
                : (f(30 * d.x, 30 * d.y), (d.x *= 0.8), (d.y *= 0.8));
            }, 10)));
        }
        (Y.supportsTouch || Y.supportsIePointer) &&
          ((l = a.element),
          (c = {}),
          (u = 0),
          (d = {}),
          (n = null),
          Y.supportsTouch
            ? (a.event.bind(l, "touchstart", t),
              a.event.bind(l, "touchmove", e),
              a.event.bind(l, "touchend", i))
            : Y.supportsIePointer &&
              (window.PointerEvent
                ? (a.event.bind(l, "pointerdown", t),
                  a.event.bind(l, "pointermove", e),
                  a.event.bind(l, "pointerup", i))
                : window.MSPointerEvent &&
                  (a.event.bind(l, "MSPointerDown", t),
                  a.event.bind(l, "MSPointerMove", e),
                  a.event.bind(l, "MSPointerUp", i))));
      },
    };
    (H.prototype.update = function() {
      this.isAlive &&
        ((this.negativeScrollAdjustment = this.isNegativeScroll
          ? this.element.scrollWidth - this.element.clientWidth
          : 0),
        b(this.scrollbarXRail, { display: "block" }),
        b(this.scrollbarYRail, { display: "block" }),
        (this.railXMarginWidth =
          A(y(this.scrollbarXRail).marginLeft) +
          A(y(this.scrollbarXRail).marginRight)),
        (this.railYMarginHeight =
          A(y(this.scrollbarYRail).marginTop) +
          A(y(this.scrollbarYRail).marginBottom)),
        b(this.scrollbarXRail, { display: "none" }),
        b(this.scrollbarYRail, { display: "none" }),
        W(this),
        C(this, "top", 0, !1, !0),
        C(this, "left", 0, !1, !0),
        b(this.scrollbarXRail, { display: "" }),
        b(this.scrollbarYRail, { display: "" }));
    }),
      (H.prototype.onScroll = function() {
        this.isAlive &&
          (W(this),
          C(this, "top", this.element.scrollTop - this.lastScrollTop),
          C(this, "left", this.element.scrollLeft - this.lastScrollLeft),
          (this.lastScrollTop = Math.floor(this.element.scrollTop)),
          (this.lastScrollLeft = this.element.scrollLeft));
      }),
      (H.prototype.destroy = function() {
        this.isAlive &&
          (this.event.unbindAll(),
          P(this.scrollbarX),
          P(this.scrollbarY),
          P(this.scrollbarXRail),
          P(this.scrollbarYRail),
          this.removePsClasses(),
          (this.element = null),
          (this.scrollbarX = null),
          (this.scrollbarY = null),
          (this.scrollbarXRail = null),
          (this.scrollbarYRail = null),
          (this.isAlive = !1));
      }),
      (H.prototype.removePsClasses = function() {
        this.element.className = this.element.className
          .split(" ")
          .filter(function(t) {
            return !t.match(/^ps([-_].+|)$/);
          })
          .join(" ");
      });
    var N = H;
    function B() {
      return (B =
        Object.assign ||
        function(t) {
          for (var e = 1; e < arguments.length; e++) {
            var n = arguments[e];
            for (var i in n)
              Object.prototype.hasOwnProperty.call(n, i) && (t[i] = n[i]);
          }
          return t;
        }).apply(this, arguments);
    }
    document.addEventListener("DOMContentLoaded", function() {
      var e = document.querySelectorAll("pre");
      Object.keys(e).forEach(function(t) {
        new N(e[t]);
      });
    });
    var q = (function() {
        function t(t, e) {
          void 0 === e && (e = {});
          (this.elm = t),
            (this.options = B({}, { duration: 400, offset: 0 }, e)),
            (this.scrolling = !1),
            this.bind();
        }
        var e = t.prototype;
        return (
          (e.bind = function() {
            this.elm.addEventListener("click", this.scroll.bind(this));
          }),
          (e.scroll = function(t) {
            var e = this,
              n = this.elm.getAttribute("href"),
              i = document.getElementById(n.replace("#", ""));
            if (i) {
              if ((t.preventDefault(), this.scrolling)) return;
              this.scrolling = !0;
              var o = i.offsetTop - this.options.offset,
                r = window.pageYOffset,
                s = Math.max(
                  document.body.clientHeight - window.innerHeight,
                  0
                );
              s < o && (o = s),
                p(
                  function(t) {
                    window.scrollTo(0, r + (o - r) * t);
                  },
                  this.options.duration,
                  function() {
                    e.scrolling = !1;
                  }
                );
            }
          }),
          t
        );
      })(),
      z = "js-smooth-scroll";
    document.addEventListener("DOMContentLoaded", function() {
      h(document.getElementsByClassName("js-smooth-scroll-container"), function(
        t
      ) {
        h(t.querySelectorAll('a[href^="#"]'), function(t) {
          t.classList.add(z);
        });
      }),
        h(document.getElementsByClassName(z), function(t) {
          new q(t, { offset: 50 });
        });
    }),
      document.addEventListener("DOMContentLoaded", function() {
        var t = document.querySelector(".js-splide-gallery");
        if (t) {
          for (
            var n,
              i = new a.a(t),
              o = document.querySelectorAll(".js-thumbnails li"),
              r = "is-active",
              e = 0,
              s = o.length;
            e < s;
            e++
          )
            !(function(t) {
              var e = o[t];
              e.addEventListener("click", function() {
                n !== e && i.go(t);
              });
            })(e);
          i.on("mounted move", function(t) {
            var e = o[void 0 !== t ? t : i.index];
            e &&
              n !== e &&
              (n && n.classList.remove(r), e.classList.add(r), (n = e));
          }),
            i.mount();
        }
      });
    function V(n, e) {
      var i;
      return {
        mount: function() {
          ((i = document.createElement("div")).style.textAlign = "center"),
            (i.style.marginTop = "0.5em");
          var t = e.Elements.track;
          t.parentElement.insertBefore(i, t.nextSibling),
            this.set(n.index + 1),
            this.bind();
        },
        bind: function() {
          var e = this;
          n.on("move", function(t) {
            e.set(t + 1);
          });
        },
        set: function(t) {
          var e = t + "/" + n.length;
          void 0 !== i.textContent ? (i.textContent = e) : (i.innerText = e);
        },
      };
    }
    document.addEventListener("DOMContentLoaded", function() {
      var t = document.querySelector(".js-splide-slide-number");
      t && new a.a(t).mount({ SlideNumber: V });
    });
  },
]);
/*! This file is auto-generated */
!(function(d, l) {
  "use strict";
  var e = !1,
    o = !1;
  if (l.querySelector) if (d.addEventListener) e = !0;
  if (((d.wp = d.wp || {}), !d.wp.receiveEmbedMessage))
    if (
      ((d.wp.receiveEmbedMessage = function(e) {
        var t = e.data;
        if (t)
          if (t.secret || t.message || t.value)
            if (!/[^a-zA-Z0-9]/.test(t.secret)) {
              var r,
                a,
                i,
                s,
                n,
                o = l.querySelectorAll(
                  'iframe[data-secret="' + t.secret + '"]'
                ),
                c = l.querySelectorAll(
                  'blockquote[data-secret="' + t.secret + '"]'
                );
              for (r = 0; r < c.length; r++) c[r].style.display = "none";
              for (r = 0; r < o.length; r++)
                if (((a = o[r]), e.source === a.contentWindow)) {
                  if ((a.removeAttribute("style"), "height" === t.message)) {
                    if (1e3 < (i = parseInt(t.value, 10))) i = 1e3;
                    else if (~~i < 200) i = 200;
                    a.height = i;
                  }
                  if ("link" === t.message)
                    if (
                      ((s = l.createElement("a")),
                      (n = l.createElement("a")),
                      (s.href = a.getAttribute("src")),
                      (n.href = t.value),
                      n.host === s.host)
                    )
                      if (l.activeElement === a) d.top.location.href = t.value;
                }
            }
      }),
      e)
    )
      d.addEventListener("message", d.wp.receiveEmbedMessage, !1),
        l.addEventListener("DOMContentLoaded", t, !1),
        d.addEventListener("load", t, !1);
  function t() {
    if (!o) {
      o = !0;
      var e,
        t,
        r,
        a,
        i = -1 !== navigator.appVersion.indexOf("MSIE 10"),
        s = !!navigator.userAgent.match(/Trident.*rv:11\./),
        n = l.querySelectorAll("iframe.wp-embedded-content");
      for (t = 0; t < n.length; t++) {
        if (!(r = n[t]).getAttribute("data-secret"))
          (a = Math.random()
            .toString(36)
            .substr(2, 10)),
            (r.src += "#?secret=" + a),
            r.setAttribute("data-secret", a);
        if (i || s)
          (e = r.cloneNode(!0)).removeAttribute("security"),
            r.parentNode.replaceChild(e, r);
      }
    }
  }
})(window, document);
