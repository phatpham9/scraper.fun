import React, { Component } from 'react';
import { Form, FormGroup, Label, Input, ButtonGroup, Table } from 'reactstrap';
import qs from 'qs';

import Button from '../Common/Button';
import CopyToClipboardButton from '../Common/CopyToClipboardButton';

import './ScraperBuilder.css';

const METHOD = 'GET';
const SCHEME = window.location.protocol;
const API_HOST = window.location.host;
const BASE_PATH = '/scrape';
const PARAMS_MAP = {
  url: 's-url',
  scope: 's-scope',
  limit: 's-limit',
  selector: 's-selector',
};
const PARAMS_MAP_REVERSE = {
  's-url': 'url',
  's-scope': 'scope',
  's-limit': 'limit',
  's-selector': 'selector',
};
const DEFAULT_TYPE = 'single';
const DEFAULT_PARAMS = {
  url: 'https://coinmarketcap.com',
  selector: '#id-bitcoin .price',
  scope: 'table#currencies tbody tr',
  selectors: [{
    key: 'name',
    value: '.currency-name .currency-name-container',
  }, {
    key: 'price',
    value: '.price',
  }],
  limit: 10,
};
const NEW_SELECTOR = {
  key: '',
  value: '',
};

const map = params => Object.keys(params).reduce((result, paramKey) => {
  if (paramKey === 'selectors') {
    return {
      ...result,
      ...(params[paramKey] || []).reduce((result2, { key, value }) => key && key.trim() && value && value.trim() ? ({
        ...result2,
        [key.trim()]: value.trim()
      }) : result2, {}),
    }
  }

  return {
    ...result,
    [PARAMS_MAP[paramKey]]: (params[paramKey] && (typeof params[paramKey] === 'string' ? params[paramKey].trim() : params[paramKey])) || undefined,
  }
}, {});

const generate = (type, { url, selector, ...rest }) => {
  const params = type === 'single' ? {
    url,
    selector,
  } : {
    url,
    ...rest,
  };

  return `${SCHEME}//${API_HOST}${BASE_PATH}${qs.stringify(map(params), {
    addQueryPrefix: true,
  })}`
};

const request = async url => {
  try {
    const res = await fetch(url, {
      method: METHOD,
    });
    const text = await res.text();

    return text;
  } catch ({ message }) {
    return message;
  }
}

const prettifyJSON = jsonString => {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2);
  } catch (e) {
    return jsonString;
  }
}

class ScraperBuilder extends Component {
  constructor(props) {
    super(props);

    const queryParams = qs.parse(window.location.search, { ignoreQueryPrefix: true });
    const { url = DEFAULT_PARAMS.url, scope = DEFAULT_PARAMS.scope, limit = DEFAULT_PARAMS.limit, selector, ...selectors } = Object.keys(queryParams).reduce((res, key) => ({
      ...res,
      ...([PARAMS_MAP_REVERSE[key] || key] && queryParams[key] ? { [PARAMS_MAP_REVERSE[key] || key]: queryParams[key] } : {}),
    }), {});

    const type = Object.keys(selectors).length > 0 ? 'multiple' : DEFAULT_TYPE;
    const params = {
      url,
      scope,
      limit,
      selector: selector || DEFAULT_PARAMS.selector,
      // transform selectors from { key: 'value' } to [{ key: 'key', value: 'value' }]
      selectors: (Object.keys(selectors).length > 0 ? Object.keys(selectors).reduce((res, key) => [
        ...res, {
          key,
          value: selectors[key],
        },
      ], []) : DEFAULT_PARAMS.selectors).concat({ ...NEW_SELECTOR }),
    };

    this.state = {
      type,
      params,
      request: generate(type, params),
      response: '',
      inProgress: false,
    };

    this.changeType = this.changeType.bind(this);
    this.changeParam = this.changeParam.bind(this);
    this.changeSelector = this.changeSelector.bind(this);
    this.removeSelector = this.removeSelector.bind(this);
    this.submit = this.submit.bind(this);
    this.changeURL = this.changeURL.bind(this);
  }

  changeType(type) {
    const { params } = this.state;

    this.setState({
      type,
      request: generate(type, params),
      response: '',
    });
  }

  changeParam(field, value) {
    const { type, params } = this.state;
    const newParams = {
      ...params,
      [field]: value,
    };

    this.setState({
      params: newParams,
      request: generate(type, newParams),
    });
  }

  changeSelector(index, field, value) {
    const { type, params: { selectors, ...rest } } = this.state;

    selectors[index][field] = value;

    const newParams = index === selectors.length - 1 && !!value ? {
      ...rest,
      selectors: [
        ...selectors,
        { ...NEW_SELECTOR },
      ],
    } : {
      ...rest,
      selectors,
    };

    this.setState({
      params: newParams,
      request: generate(type, newParams),
    });
  }

  removeSelector(index) {
    const { type, params: { selectors, ...rest } } = this.state;

    selectors.splice(index, 1);

    const newParams = {
      ...rest,
      selectors,
    };

    this.setState({
      params: newParams,
      request: generate(type, newParams),
    });
  }

  async submit(e) {
    e.preventDefault();

    this.setState({
      inProgress: true,
    }, async () => {
      const response = await request(this.state.request);

      this.setState({
        response,
        inProgress: false,
      }, () => {
        this.changeURL();
      });
    });
  }

  changeURL() {
    const { type, params: { url, selector, scope, selectors, limit } } = this.state;
    const queryString = qs.stringify({
      's-url': url,
      's-scope': scope,
      's-limit': limit,
      // transform [{ key: 'key', value: 'value' }] to { key: 'value' }
      ...(type === 'single' ? {
        's-selector': selector,
      } : selectors.reduce((res, { key, value }) => ({
        ...res,
        ...(key && value ? { [key]: value } : {}),
      }), {})),
    }, { addQueryPrefix: true });

    window.history.pushState('', '', `${window.location.origin}${queryString}`);
  }

  render() {
    return (
      <div className="scraper-builder">
        <Form onSubmit={this.submit}>
          <FormGroup>
            <ButtonGroup className="selector-type">
              <Button type="button" outline active={this.state.type === 'single'} onClick={e => this.changeType('single')}>Single selector</Button>

              <Button type="button" outline active={this.state.type === 'multiple'} onClick={e => this.changeType('multiple')}>Multiple selectors</Button>
            </ButtonGroup>
          </FormGroup>

          <FormGroup>
            <Label for="url">URL</Label>
            <Table size="sm">
              <tbody>
                <tr>
                  <td>
                    <Input type="text" value={PARAMS_MAP['url']} readOnly />
                  </td>

                  <td>
                    <Input type="url" id="url" placeholder="Website URL" value={this.state.params.url} onChange={e => this.changeParam('url', e.target.value)} required />
                  </td>
                </tr>
              </tbody>
            </Table>
          </FormGroup>

          {this.state.type === 'single' ? (
            <div className="single-selector">
              <FormGroup>
                <Label for="selector">Selector</Label>
                <Table size="sm">
                  <tbody>
                    <tr>
                      <td>
                        <Input type="text" value={PARAMS_MAP['selector']} readOnly />
                      </td>

                      <td>
                        <Input type="text" id="selector" placeholder="CSS selector" value={this.state.params.selector} onChange={e => this.changeParam('selector', e.target.value)} required />
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </FormGroup>
            </div>
          ) : (
            <div className="multiple-selectors">
              <FormGroup>
                <Label for="scope">Scope</Label>
                <Table size="sm">
                  <tbody>
                    <tr>
                      <td>
                        <Input type="text" value={PARAMS_MAP['scope']} readOnly />
                      </td>

                      <td>
                        <Input type="text" id="scope" placeholder="CSS selector" value={this.state.params.scope} onChange={e => this.changeParam('scope', e.target.value)} required />
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </FormGroup>

              <FormGroup>
                <Label for="s-selectors">Selectors</Label>
                <Table size="sm">
                  <tbody>
                    {this.state.params.selectors.map(({ key, value }, index) => (
                      <tr key={index}>
                        <td>
                          <Input type="text" placeholder="Param name" value={key} onChange={e => this.changeSelector(index, 'key', e.target.value)} required={index < this.state.params.selectors.length - 1} />
                        </td>

                        <td>
                          <Input type="text" placeholder="CSS selector" value={value} onChange={e => this.changeSelector(index, 'value', e.target.value)} required={index < this.state.params.selectors.length - 1} />
                        </td>

                        <td>
                          {index < this.state.params.selectors.length - 1 && <Button type="button" outline onClick={e => this.removeSelector(index)}>
                            <span aria-hidden="true">&times;</span>
                          </Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </FormGroup>

              <FormGroup>
                <Label for="limit">Limit (optional)</Label>
                <Table size="sm">
                  <tbody>
                    <tr>
                      <td>
                        <Input type="text" value={PARAMS_MAP['limit']} readOnly />
                      </td>

                      <td>
                        <Input type="number" id="limit" placeholder="Limit" value={this.state.params.limit} onChange={e => this.changeParam('limit', e.target.value)} />
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </FormGroup>
            </div>
          )}

          <FormGroup className="request clearfix">
            <Label>Request</Label>
            <CopyToClipboardButton className="btn-copy-to-cb float-right" value={this.state.request} />
            <code className="d-block">{this.state.request}</code>
          </FormGroup>

          <Button color="primary" type="submit" block busy={this.state.inProgress} busyText="Requesting...">Test</Button>
        </Form>

        {!!this.state.response && (
          <FormGroup className="response">
            <Label>Response</Label>
            <CopyToClipboardButton className="btn-copy-to-cb float-right" value={this.state.type === 'single' ? this.state.response : prettifyJSON(this.state.response)} />
            <code className="d-block">{this.state.type === 'single' ? this.state.response : prettifyJSON(this.state.response)}</code>
          </FormGroup>
        )}
      </div>
    );
  }
}

export default ScraperBuilder;
