import React from 'react';
import AWN from 'awesome-notifications';
import './App.css';
import './awesome-notifications.css';

let requestInFlight = false;
let dirty = false;
let pendingPrompt = '';
let pendingDesiredCompletions = ['', ''];

let notifier = new AWN()

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop: string) => searchParams.get(prop),
});

function App() {
  const [prompt, setPrompt] = React.useState((params as any).prompt || 'When John and Mary went to the store, Mary gave a bottle of milk to');
  const [desiredCompletions, setDesiredCompletions] = React.useState(JSON.parse((params as any).comps) || [' John', ' Mary']);
  const [lastTimeout, setLastTimeout] = React.useState<any>(null);
  const [output, setOutput] = React.useState<any>({
    tokenizedPrompt: [],
    tokenizedCompletions: [['']],
    probs: [], 
    topTokens: [],
    topProbs: [], 
    samples: [],
  })

  async function callBackend(prompt: string, desiredCompletions: Array<string>) {
    dirty = false;
  	requestInFlight = true;
    try {
      if (window.location.hostname === '127.0.0.1') {
        const response = await window.fetch(`http://${window.location.hostname}:5000/get_info`, {
          method: "post",
          body: JSON.stringify({prompt, desiredCompletions}),
        });
        setOutput(await response.json());
      } else {
        const response = await window.fetch(`${window.location.origin}/get_info`, {
          method: "post",
          body: JSON.stringify({prompt, desiredCompletions}),
        });
        setOutput(await response.json());
      }
    } finally {
      requestInFlight = false;
    }
    if (dirty) {
    	await callBackend(pendingPrompt, pendingDesiredCompletions);
    }
  }

  function reprocess() {
    pendingPrompt = prompt;
    pendingDesiredCompletions = desiredCompletions;
    clearTimeout(lastTimeout);
    const timeoutHandle = setTimeout(async () => {
      if (!requestInFlight) 
        await callBackend(prompt, desiredCompletions);
    }, 100);
    setLastTimeout(timeoutHandle)
  }
  React.useEffect(reprocess, [prompt, desiredCompletions])

  return (
    <div style={{ margin: 20 }}>
      <div>
        <h1>
          Model behavior search tool
        </h1>
      </div>
      <div style={{ margin: 10 }}>
        Running model: GPT-2 small (117M parameters) <br/>
        Be careful about blank spaces! Most tokens start with a space, e.g. use " Mary" and not "Mary".
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', wordWrap: 'break-word' }}>
        <div style={{ width: '30%', padding: 5, borderStyle: 'solid', borderWidth: 'thin', borderRadius: '5px' }}>
          Write input to the model here: <br/>
          <textarea
            value={prompt}
            rows={5}
            onChange={(event) => {
              dirty = true;
              setPrompt(event.target.value)
            }}
            style={{ width: '90%', margin: 10 }}
          /> <br/>
          <div style={{ margin: 5 }}>
            {output.tokenizedPrompt.map((token: string, index: number) =>
              <span className="token" key={index}>{token}</span>)}
          </div>
        </div>
        <div style={{ width: '40%', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: 5, borderStyle: 'solid', borderWidth: 'thin', borderRadius: '5px' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column',  rowGap: '10px'}}>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '60%'}}>
              Desired completion:
              </div>
              <div style={{ width: '20%'}}>
              Probability:
              </div>
            </div>
            {
              desiredCompletions.map((comp: string, index: number) => 
                <div style={{ display: 'flex', justifyContent: 'space-around'}}> 
                  <div style={{ width: '50%', padding: '5px', margin: '5px', borderStyle: 'solid', borderWidth: 'thin', borderRadius: '5px' }}>
                    <input
                      value={comp}
                      onChange={(event) => {
                        dirty = true;
                        desiredCompletions[index] = event.target.value;
                        setDesiredCompletions([...desiredCompletions]);
                      }}
                      style={{ width: '95%' }}
                    /> <br/>
                    {
                      index < output.tokenizedCompletions.length && 
                        output.tokenizedCompletions[index].map((token: string, i: number) =>
                          <span className="token" key={i}>{token}</span>)
                    }
                  </div>
                  <div style={{ width: '20%', margin: 10 }}>
                    {
                      index < output.probs.length &&
                        (output.probs[index] * 100).toFixed(1)
                    }%
                  </div>
                  <div style={{ margin: 5 }}>
                    <button
                      onClick={() => {
                        setDesiredCompletions([...desiredCompletions.slice(0, index), ...desiredCompletions.slice(index+1)]);
                        output.tokenizedCompletions = [...output.tokenizedCompletions.slice(0, index), ...output.tokenizedCompletions.slice(index+1)];
                        output.probs = [...output.probs.slice(0, index), ...output.probs.slice(index+1)];
                        setOutput(output);
                      }}>
                        Delete
                    </button>
                  </div>
              </div>)
            }
            <div style={{ margin: 10}}>
              <button
                onClick={() => setDesiredCompletions([...desiredCompletions, ''])}>
                  Add
              </button>
            </div>
          </div>
        </div>
        <div style={{ width: '20%', padding: 5, borderStyle: 'solid', borderWidth: 'thin', borderRadius: '5px' }}>
          Top tokens <br/>
          <table>
            <tbody>
              {output.topTokens.map((token: string, index: number) =>
              <tr key={index}> 
                <td><span className="token">{token}</span></td>
                <td><span> {(output.topProbs[index] * 100).toFixed(1)}% </span></td>
              </tr> )}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ width: '95%', margin: 10, padding: 5, borderStyle: 'solid', borderWidth: 'thin', borderRadius: '5px'}}>
        Samples <br/> 
        {output.samples.map((sample: string, index: number) =>
          <div key={index}><span style={{ color: '#4747de' }}>{sample.slice(0,pendingPrompt.length)}</span>{sample.slice(pendingPrompt.length)}</div>)}
      </div>
      <button style={{ margin: 10 }}
        onClick={() => {
          navigator.clipboard.writeText(
            window.location.origin + '?prompt=' + encodeURIComponent(prompt) 
            + '&comps=' + encodeURIComponent(JSON.stringify(desiredCompletions)));
          notifier.success("copied to clipboard", { durations: {global: 1000} });
        }
      }>
        Share URL
      </button>
    </div>
  );
}

export default App;
