(function (angular) {
    /**
     * @return object
     * */
    function Utils() {
        var _this = this;
        var fn = {};
        fn = {
            /**
             * @param {*} value
             * */
            isNull: function (value) { return null === value; },
            /**
             * @param {*} value
             * */
            isUndefined: function (value) { return undefined === value; },
            /**
             * @param {*} value
             * */
            isEmpty: function (value) {
                if (value === null || value === undefined)
                    return true;
                else if (angular.isArray(value) || typeof value === 'string')
                    return value.length == 0;
                else if (angular.isObject(value))
                    return Object.keys(value).length == 0;
                else if (typeof value === 'number')
                    return value === 0;
                else
                    return String(value).length === 0;
            },
            /**
             * @param {*} value
             * */
            isString: function (value) { return typeof value === 'string'; },
            /**
             * @param {*} value
             * */
            isInteger: function (value) { return Number(value) === value && value % 1 === 0; },
            /**
             * @param {*} value
             * */
            isFloat: function (value) { return Number(value) === value && value % 1 !== 0; },
            /**
             * @param {*} value
             * */
            isBoolean: function (value) { return value === true || value === false; },
            /**
             * @param {string} from
             * @param {object} to
             * */
            replace: function (from, to) {
                if (to === undefined || to === null)
                    to = {};
                if (!angular.isObject(to))
                    throw new Error('Utils.replace: second param: requiere a object:' + typeof to);
                if (from.length == 0)
                    throw new Error('Utils.replace: first param: requiere a input text');
                var properties = from.match(/[^{}]+(?=\})/g) || [];
                for (var property in properties) {
                    var value = '';
                    if (to.hasOwnProperty(property))
                        value = to[property];
                    from = from.replace('{' + property + '}', value);
                }
                return from;
            },
            /**
             * @param {*} array
             * @param {*} value
             * */
            contains: function (array, value) { return array.indexOf(value) >= 0; },
            /**
             *  Remove repeat item in array
             *
             * @param {*} value
             * @return Array
             * */
            unique: function (value) {
                var a = value.concat();
                for (var i = 0; i < a.length; ++i) {
                    for (var j = i + 1; j < a.length; ++j) {
                        if (a[i] === a[j])
                            a.splice(j--, 1);
                    }
                }
                return a;
            },
            /**
             * Get datatype of a value
             *
             * @param {*} value
             * @return string
             * */
            getDataType: function (value) {
                if (angular.isArray(value))
                    return 'array';
                else if (angular.isObject(value))
                    return 'object';
                else if (_this.isInteger(value))
                    return 'integer';
                else if (_this.isFloat(value))
                    return 'float';
                else if (_this.isBoolean(value))
                    return 'boolean';
                else if (_this.isLong(value))
                    return 'long';
                return 'undefined';
            },
            /**
             * Check if datatype of value is same to...
             *
             * @param {*} value
             * @param {string} datatype
             * @return boolean
             * */
            isDatatype: function (value, datatype) {
                if (datatype === 'double')
                    datatype = 'float';
                else if (datatype === 'long')
                    datatype = 'integer';
                return _this.getDataType(value) === datatype;
            }
        };
        return fn;
    }
    angular
        .module('angular-swagger-client', [])
        .factory('Utils', Utils)
        .factory('AngularSwaggerClient', AngularSwaggerClient);
    //AngularSwaggerClient.$inject = ['$http', 'Utils', '$httpParamSerializer', '$q'];
    /**
     *
     * @param {*} $http
     * @param {*} Utils
     * @param {*} $httpParamSerializer
     * @param {*} $q
     * */
    function AngularSwaggerClient($http, Utils, $httpParamSerializer, $q) {
        var self = this;
        var swaggerObject;
        var defaultDataObject;
        var localStorageKeysArray;
        /**
         *
         * @param {object} jsonObject
         * @param {object} defaultData
         * @param {Array} localStorageKeys
         * */
        var AngularSwaggerClient = function (jsonObject, defaultData, localStorageKeys) {
            console.info('jsonObject:', jsonObject);
            this.api = {};
            this.host = {};
            this.localStorageKeys = localStorageKeys || [];
            this.defaultData = defaultData || {};
            if (!jsonObject || jsonObject === '') {
                throw new Error("Invalid json Object.");
            }
            defaultDataObject = defaultData || {};
            localStorageKeysArray = localStorageKeys || [];
            swaggerObject = jsonObject;
            return this.init();
        };
        /**
         * */
        AngularSwaggerClient.prototype.init = function () {
            var self = this;
            var scheme = 'http';
            if (swaggerObject.schemes.indexOf('https') > -1) {
                scheme += 's';
            }
            self.host = scheme + '://' + swaggerObject.host
                .replace(/\/+/, '/')
                .replace(/(^\/+|\/+$)/, '') + '/';
            angular.forEach(swaggerObject.paths, function (paths, key) {
                angular.forEach(paths, function (path, innerKey) {
                    var namespace;
                    if (!path.hasOwnProperty('tags')) {
                        namespace = key.split('/')[1];
                        if (Utils.isEmpty(namespace)) {
                            namespace = swaggerObject.basePath.split('/')[1];
                        }
                    }
                    else {
                        namespace = path.tags[0];
                    }
                    namespace = namespace.replace(/[{}]/g, "");
                    if (!self.api[namespace]) {
                        self.api[namespace] = {};
                    }
                    if (!path.operationId) {
                        path.operationId = innerKey;
                    }
                    /**
                     * Store all api params to prepare before call it
                     * @property {object} swaggerRequest
                     * */
                    var swaggerRequest = {
                        uri: key.replace(/\/+/g, '/').replace(/(^\/|\/$)/g, '').trim(),
                        data: {
                            //paths       : [],
                            headers: [],
                            formData: [],
                            query: []
                        },
                        params: {},
                        input: {},
                        config: {},
                        localStorage: localStorageKeysArray
                    };
                    /**
                     * Process parameters by api based on parametersDefinitionsObject and parameterObject
                     * @link http://swagger.io/specification/#parametersDefinitionsObject
                     * @link http://swagger.io/specification/#parameterObject
                     * */
                    angular.forEach(path.parameters, function (param) {
                        if (swaggerRequest.data.hasOwnProperty(param.in)) {
                            var expected = param.type;
                            switch (param.type) {
                                case 'double':
                                    param.type = 'float';
                                    break;
                                case 'long':
                                    param.type = 'integer';
                                    break;
                                case 'byte':
                                case 'binary':
                                case 'date':
                                case 'dateTime':
                                case 'password':
                                    param.type = 'string';
                                    break;
                                default:
                                    expected = param.type;
                                    break;
                            }
                            swaggerRequest.params[param.name] = {
                                "name": param.name,
                                "required": param.required === true,
                                "type": param.type || 'string',
                                "expected": expected,
                                "in": param.in,
                                "format": param.format || 'string'
                            };
                            swaggerRequest.data[param.in].push(param.name);
                        }
                    });
                    /**
                     * Process security definitions based on securityDefinitionsObject and securitySchemeObject
                     * @link http://swagger.io/specification/#securityDefinitionsObject
                     * @link http://swagger.io/specification/#securitySchemeObject
                     * */
                    if (swaggerObject.hasOwnProperty('securityDefinitions')) {
                        angular.forEach(path.security, function (rule) {
                            angular.forEach(rule, function (value, property) {
                                if (swaggerObject.securityDefinitions.hasOwnProperty(property)) {
                                    var security = swaggerObject.securityDefinitions[property];
                                    swaggerRequest.params[security.name] = {
                                        "required": true,
                                        "type": 'string',
                                        "in": security.in,
                                        "format": security.type
                                    };
                                    if (swaggerRequest.data.hasOwnProperty(security.in)) {
                                        swaggerRequest.data[security.in].push(security.name);
                                    }
                                }
                            });
                        });
                    }
                    /**
                     * Create a api function
                     * @param {object} data - This object need contains all params you need passed
                     * @param {object} config - If you need set you own config, you need set a object based on $http
                     * @link https://docs.angularjs.org/api/ng/service/$http
                     * */
                    self.api[namespace][path.operationId] = function (data, config) {
                        console.info('data #1:', data);
                        if (angular.isObject(data) && data !== null) {
                            swaggerRequest.input = angular.extend({}, swaggerRequest.input, data);
                        }
                        if (angular.isObject(config) && config !== null) {
                            swaggerRequest.config = angular.extend({}, swaggerRequest.config, config);
                        }
                        return self.trigger(key, innerKey, swaggerRequest);
                    };
                });
            });
        };
        /**
         *
         * @param {string} path
         * @param {string} method
         * @param {object} swaggerRequest
         * */
        AngularSwaggerClient.prototype.trigger = function (path, method, swaggerRequest) {
            var serializedUriQuery;
            var self = this;
            if (angular.isObject(defaultDataObject)) {
                swaggerRequest.input = angular.extend({}, swaggerRequest.input, defaultDataObject);
            }
            angular.forEach(swaggerRequest.localStorage, function (name) {
                var value = window.localStorage.getItem(name) || window.localStorage[name] || null;
                if (value !== null && value !== undefined) {
                    swaggerRequest.input[name] = value;
                }
            });
            //
            var properties = swaggerRequest.uri.match(/[^{}]+(?=\})/g);
            angular.forEach(properties, function (property) {
                var value = '';
                if (swaggerRequest.input.hasOwnProperty(property)) {
                    value = swaggerRequest.input[property];
                }
                swaggerRequest.uri = swaggerRequest.uri.replace('{' + property + '}', value);
            });
            //
            var finalResponse = {
                uri: swaggerRequest.uri,
                status: null,
                statusText: null,
                data: null,
                validation: [],
                values: swaggerRequest.input,
                params: swaggerRequest.params
            };
            /**
             * By default, $http don't set content-type:application/x-www-form-urlencoded for POST and PUT
             * So, if you need send a POST or PUT, angular-swagger-client set this header.
             * Learn more about this case in the link
             * @link http://stackoverflow.com/a/20276775/901197
             * */
            if (method === 'post' || method === 'put') {
                swaggerRequest.data.headers['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';
            }
            /**
             * Prepare formData only if the method is POST, PUT, CONNECT or PATCH
             * @todo learn more about when, where and how to use form data
             */
            if (['post', 'put', 'connect', 'patch'].indexOf(method) > -1) {
                angular.forEach(swaggerRequest.data.formData, function (name, index) {
                    if (swaggerRequest.input.hasOwnProperty(name)) {
                        swaggerRequest.data.formData[name] = swaggerRequest.input[name];
                        /**
                         * If the parameter is found, it must be removed so that it is not reused in another parameter,
                         * otherwise it could generate a totally unnecessary conflict.
                         * */
                        delete swaggerRequest.input[name];
                    }
                    else {
                        delete swaggerRequest.data.formData[index];
                    }
                });
                /**
                 * After searching and assigning the values to formData, it is necessary to convert formData
                 * into a valid notation.
                 * */
                swaggerRequest.data.formData = $httpParamSerializer(swaggerRequest.data.formData);
            }
            /**
             * Prepare query params for all methods and only if it have one or more items
             * */
            if (swaggerRequest.data.query.length > 0) {
                var httpQueryObject_1 = {};
                angular.forEach(swaggerRequest.data.query, function (name, index) {
                    if (swaggerRequest.input.hasOwnProperty(name)) {
                        httpQueryObject_1[name] = swaggerRequest.input[name];
                        delete swaggerRequest.input[name];
                    }
                    else {
                        delete swaggerRequest.data.query[index];
                    }
                });
                finalResponse.uri += '?' + $httpParamSerializer(httpQueryObject_1);
            }
            console.info('swaggerRequest.data.query:', swaggerRequest.data.query);
            /**
             * Apply a pre-validator: check required, data type and format
             * */
            angular.forEach(swaggerRequest.params, function (item, param) {
                /**
                 * Check if is required
                 * */
                if (!swaggerRequest.input.hasOwnProperty(param) && param.required === true) {
                    finalResponse.validation.push(param.name + ' is required and should be a ' + item.expected);
                }
                else if (swaggerRequest.input.hasOwnProperty(param)) {
                    if (!Utils.isDatatype(swaggerRequest.input[param], param.type)) {
                        finalResponse.validation.push(param.name + ' should be a ' + param.expected);
                    }
                }
                /**
                 * @todo Check format
                 * */
            });
            console.info('finalResponse.uri:', finalResponse.uri);
            console.info('finalResponse.uri:', this.host);
            var httpConfig = {
                url: this.host + finalResponse.uri,
                method: method,
                data: swaggerRequest.data.formData,
                headers: swaggerRequest.data.headers
            };
            // prepare promise
            var defered = $q.defer();
            var promise = defered.promise;
            // If you have validation errors, you can't send xhr
            if (finalResponse.validation.length > 0) {
                defered.reject(finalResponse);
            }
            else {
                $http(httpConfig).then(function (response) {
                    finalResponse.status = response.status;
                    finalResponse.statusText = response.statusText;
                    finalResponse.data = response.data;
                    defered.resolve(finalResponse);
                }, function (response) {
                    finalResponse.status = response.status;
                    finalResponse.statusText = response.statusText;
                    finalResponse.data = response.data;
                    defered.reject(finalResponse);
                });
            }
            return promise;
        };
        return AngularSwaggerClient;
    }
})(angular);