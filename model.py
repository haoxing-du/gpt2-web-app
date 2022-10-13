import torch
import torch.nn as nn
from easy_transformer.EasyTransformer import EasyTransformer

model_name = "gpt2"  # @param ['gpt2', 'gpt2-medium', 'gpt2-large', 'gpt2-xl', 'facebook/opt-125m', 'facebook/opt-1.3b', 'facebook/opt-2.7b', 'facebook/opt-6.7b', 'facebook/opt-13b', 'facebook/opt-30b', 'facebook/opt-66b', 'EleutherAI/gpt-neo-125M', 'EleutherAI/gpt-neo-1.3B', 'EleutherAI/gpt-neo-2.7B', 'EleutherAI/gpt-j-6B', 'EleutherAI/gpt-neox-20b']
model = EasyTransformer.from_pretrained(model_name) #, use_attn_result=True)
if torch.cuda.is_available():
    model.to("cuda")

def show_tokens(model, tokens, prepend_bos=False):
    # Prints the tokens as text, separated by |
    if type(tokens)==str:
        # If we input text, tokenize first
        tokens = model.to_tokens(tokens, prepend_bos=prepend_bos)[0]
    text_tokens = [repr(model.tokenizer.decode(t))[1:-1] for t in tokens]
    return text_tokens

def sample_next_token(
    model, input_ids: torch.Tensor, temperature=1.0, freq_penalty=0.0, top_k=0, top_p=0.0, cache=None
) -> torch.Tensor:
    assert input_ids.ndim == 1, "input_ids should be a 1D sequence of token ids"
    model.eval()
    with torch.inference_mode():
        all_logits = model(input_ids.unsqueeze(0))  # TODO: cache
    B, S, E = all_logits.shape
    logits = all_logits[0, -1]
    return logits

def get_topk_completions(model: EasyTransformer, input: str, k: int, device: torch.device):
    logits = model(input)[0, -1]
    log_softmax = nn.LogSoftmax(dim=-1)
    log_probs = log_softmax(logits)
    values, indices = torch.topk(log_probs, k=k)
    top_tokens = [repr(model.tokenizer.decode(index))[1:-1] for index in indices]
    top_log_probs = [value.item() for value in torch.exp(values)]
    return top_tokens, top_log_probs

def get_pos(completion: str, prompt: str):
    completion_toks = model.to_tokens(completion, prepend_bos=False)[0]
    prompt_toks = model.to_tokens(prompt, prepend_bos=True)[0]
    len_prompt = len(prompt_toks)
    len_completion = len(completion_toks)
    # -1 because probability of a token is at the previous positions
    return torch.arange(len_prompt - 1, len_prompt + len_completion - 1)

def evaluate_prob(model: EasyTransformer, completion: str, prompt: str):
    if completion == '':
        return 0.0
    with torch.inference_mode():
        logits = model(prompt + completion)
        log_softmax = nn.LogSoftmax(dim=-1)
        log_probs = log_softmax(logits)
        pos = get_pos(completion, prompt)
        tokens = model.to_tokens(completion, prepend_bos=False)[0]
        assert len(pos) == len(tokens)
        completion_log_probs = log_probs[0, pos, tokens]
        prob = torch.exp(completion_log_probs).prod().item()
    return prob