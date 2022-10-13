import json
import os
from lib2to3.pgen2 import token
from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from model import *

app = Flask(
    __name__,
    static_url_path='',
    static_folder='front-end/build',
    )
cors = CORS(app, resources={"*": {"origins": "*"}})

@app.route("/")
def serve_static():
    return app.send_static_file('index.html')

@app.route("/get_info", methods=["POST"])
def get_info():
    try:
        data = json.loads(request.data)
        prompt = data["prompt"]
        desired_completions = data["desiredCompletions"]
        tokenized_prompt = show_tokens(model, prompt, prepend_bos=True)
        if len(tokenized_prompt) > 1000:
            print("Truncating input to 1000 tokens")
            tokenized_prompt = tokenized_prompt[-1000:] # This doesn't really prevent the CUDA error. I think the error happens in the show_tokens call above?
        tokenized_comps = []
        probs = []
        for comp in desired_completions:
            tokenized_comps.append(show_tokens(model, comp))
            probs.append(evaluate_prob(model, comp, prompt))
        top_tokens, top_probs = get_topk_completions(model, prompt, 10, model.cfg.device)
        samples = []
        for i in range(5):
            if prompt == '':
                samples.append('')
            else:
                samples.append(model.generate(prompt, prepend_bos=False))
        return jsonify({
            "tokenizedPrompt": tokenized_prompt,
            "tokenizedCompletions": tokenized_comps,
            "probs": probs,
            "topTokens": top_tokens,
            "topProbs": top_probs,
            "samples": samples})
    except RuntimeError :
        print("\x1b[91m CUDA error, restarting worker \x1b[0m")
        os._exit(1)

if __name__ == '__main__':
    app.run()