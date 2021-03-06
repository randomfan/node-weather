import axios from 'axios'

class PostcodesIoApi {
    // constructor to set up base config for API, and definitions for the available endpoints
    constructor() {
        this.baseUrl = "https://api.postcodes.io"
        this.endpoints = {
            // endpoint for looking up single postcode
            lookup: (options = {}) => {
                if (!options.postcode) throw new Error('A postcode is required for the lookup action')
                return {
                    method: 'get',
                    resource: `/postcodes/${encodeURIComponent(options.postcode)}`,
                    params: {},
                    headers: null,
                    body: null,
                }
            },
            // endpoint for getting random postcode
            random: (options = {}) => {
                return {
                    method: 'get',
                    resource: `/random/postcodes`,
                    params: {},
                    headers: null,
                    body: null,
                }
            },
            // endpoint for validating single postcode
            validate: (options = {}) => {
                if (!options.postcode) throw new Error('A postcode is required for the lookup action')
                return {
                    method: 'get',
                    resource: `/postcodes/${encodeURIComponent(options.postcode)}/validate`,
                    params: {},
                    headers: null,
                    body: null,
                }
            },
            // endpoint for bulk lookup list of postcodes
            bulklookup: (options = {}) => {
                return {
                    method: 'post',
                    resource: `/postcodes`,
                    params: {},
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        ...options,
                    },
                }
            }
        }
    }

    // function to make the API request to server using given endpoint, and return complete JSON data
    async request(action, options = {}) {
        // make sure an action is specified
        if (!action) {
            throw Error('you must specify a pre-defined action when calling request function')
        }

        // get pre-defined request definition for the given action
        const getEndpointDefinition = this.endpoints[action]
        if (!getEndpointDefinition) {
            throw Error(`api action [${action}] not recognised by wrapper class`)
        }
        const endpoint = getEndpointDefinition(options)
        
        // make api call using axios library
        try {
            const response = await axios({
                method: endpoint.method,
                url: `${this.baseUrl}${endpoint.resource}`,
                data: endpoint.body ? JSON.stringify(endpoint.body) : null,
                headers: endpoint.headers
            })
            return response.data
        } catch (error) {
            if (error.response) {
                // response received from server with non-2xx code
                console.log(error.response.data)
                throw new Error(`error response from server: ${error.response.data.status} ${error.response.data.error}`)
            } else if (error.request) {
                // request made but no response received
                console.log(error.message)
                throw new Error(error.message)
            } else {
                // error setting up request
                console.log(error.message)
                throw new Error(error.message)
            }
        }
        
    }
}
  
export default new PostcodesIoApi();