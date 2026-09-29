"""
EmergentIntegrations Replacement Module

Provides the same interface as emergentintegrations.llm.chat and emergentintegrations.llm.openai.speech_to_text
using publicly available packages:
- openai for transcription (Whisper)
- google-generativeai for Gemini chat
"""
import os
import json
import logging
import httpx
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Try to import the required packages
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("openai package not available")

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    logger.warning("google-generativeai package not available")


# =============================================================================
# Speech-to-Text Replacement (Whisper via OpenAI API)
# =============================================================================

class OpenAISpeechToText:
    """
    Replacement for emergentintegrations.llm.openai.speech_to_text.OpenAISpeechToText
    Uses OpenAI's official Whisper API directly.
    """
    
    def __init__(self, api_key: str):
        if not OPENAI_AVAILABLE:
            raise ImportError("openai package not installed. Install with: pip install openai")
        self.api_key = api_key
        self.client = openai.OpenAI(api_key=api_key)
    
    async def transcribe(
        self, 
        audio_file, 
        model: str = "whisper-1", 
        response_format: str = "text",
        language: Optional[str] = None,
        prompt: Optional[str] = None,
        temperature: float = 0.0
    ) -> str:
        """
        Transcribe audio file using OpenAI Whisper API.
        
        Args:
            audio_file: File-like object or path to audio file
            model: Model to use (default: whisper-1)
            response_format: Format of response (text, json, verbose_json, etc.)
            language: Language code (ISO-639-1)
            prompt: Optional prompt to guide transcription
            temperature: Sampling temperature (0-1)
            
        Returns:
            Transcribed text as string (or dict if response_format is not "text")
        """
        try:
            # Handle both file paths and file-like objects
            if hasattr(audio_file, 'read'):
                # It's a file-like object
                audio_file.seek(0)
                file_content = audio_file.read()
                # Create a temporary file-like object for OpenAI
                import io
                file_obj = io.BytesIO(file_content)
                file_obj.name = getattr(audio_file, 'name', 'audio.m4a')
                audio_file = file_obj
            
            response = await self._transcribe_async(
                audio_file=audio_file,
                model=model,
                response_format=response_format,
                language=language,
                prompt=prompt,
                temperature=temperature
            )
            
            if response_format == "text":
                return response.text
            return response
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise
    
    async def _transcribe_async(self, audio_file, model, response_format, language, prompt, temperature):
        """Async wrapper for OpenAI transcription"""
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _transcribe():
            return self.client.audio.transcriptions.create(
                file=audio_file,
                model=model,
                response_format=response_format,
                language=language,
                prompt=prompt,
                temperature=temperature
            )
        
        return await asyncio.get_event_loop().run_in_executor(None, _transcribe)


# =============================================================================
# AssemblyAI Speech-to-Text
# =============================================================================

class AssemblyAISpeechToText:
    """
    AssemblyAI Speech-to-Text transcription.
    Uses AssemblyAI's API for high-quality speech-to-text transcription.
    """
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    async def transcribe(
        self, 
        audio_file, 
        language: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio file using AssemblyAI API.
        
        Args:
            audio_file: File-like object or path to audio file
            language: Language code (ISO-639-1)
            prompt: Optional prompt to guide transcription
            
        Returns:
            Transcribed text as string
        """
        try:
            # Handle both file paths and file-like objects
            if hasattr(audio_file, 'read'):
                # It's a file-like object
                audio_file.seek(0)
                file_content = audio_file.read()
                # Create a temporary file-like object for AssemblyAI
                import io
                file_obj = io.BytesIO(file_content)
                file_obj.name = getattr(audio_file, 'name', 'audio.m4a')
                audio_file = file_obj
            
            # Use raw HTTP API to avoid SDK version issues
            import httpx
            headers = {
                "authorization": self.api_key,
                "content-type": "application/json"
            }
            upload_response = await self._upload_audio(audio_file)
            audio_url = upload_response["upload_url"]
            
            transcript_request = {
                "audio_url": audio_url,
                "speech_models": ["universal-2"],
            }
            if language:
                transcript_request["language_code"] = language
            if prompt:
                transcript_request["prompt"] = prompt
                
            transcript_response = await self._request_transcription(transcript_request)
            transcript_id = transcript_response["id"]
            
            # Poll for completion
            transcript_result = await self._poll_transcription(transcript_id)
            
            if transcript_result["status"] == "error":
                raise RuntimeError(f"AssemblyAI transcription failed: {transcript_result.get('error', 'Unknown error')}")
            
            return transcript_result.get("text", "")
        
        except Exception as e:
            logger.error(f"AssemblyAI transcription failed: {e}")
            raise
    
    async def _upload_audio(self, audio_file):
        """Upload audio file to AssemblyAI"""
        import io
        
        # Handle both file paths and file-like objects
        if hasattr(audio_file, 'read'):
            audio_file.seek(0)
            file_content = audio_file.read()
            content = file_content
        elif isinstance(audio_file, str):
            with open(audio_file, "rb") as f:
                content = f.read()
        else:
            content = audio_file.getvalue() if hasattr(audio_file, 'getvalue') else bytes(audio_file)
        
        headers = {
            "authorization": self.api_key,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.assemblyai.com/v2/upload",
                headers={"authorization": self.api_key},
                content=content
            )
            response.raise_for_status()
            return response.json()

    async def _request_transcription(self, transcript_request):
        """Request transcription from AssemblyAI"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers={
                    "authorization": self.api_key,
                    "content-type": "application/json"
                },
                json=transcript_request
            )
            response.raise_for_status()
            return response.json()

    async def _poll_transcription(self, transcript_id):
        """Poll for transcription completion"""
        import asyncio
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                response = await client.get(
                    f"https://api.assemblyai.com/v2/transcript/{transcript_id}",
                    headers={"authorization": self.api_key}
                )
                response.raise_for_status()
                result = response.json()
                
                status = result.get("status")
                if status == "completed":
                    return result
                elif status == "error":
                    return result
                
                await asyncio.sleep(3)


# =============================================================================
# Chat/Message Classes for Gemini
# =============================================================================

@dataclass
class UserMessage:
    """Replacement for emergentintegrations.llm.chat.UserMessage"""
    text: str
    role: str = "user"
    
    def __init__(self, text: str, role: str = "user"):
        self.text = text
        self.role = role


@dataclass
class ModelConfig:
    """Configuration for model parameters"""
    provider: str
    model_name: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: float = 1.0
    top_k: int = 40


class LlmChat:
    """
    Replacement for emergentintegrations.llm.chat.LlmChat
    Uses Google Generative AI SDK (google-generativeai) for Gemini models.
    """
    
    def __init__(
        self, 
        api_key: str, 
        session_id: str, 
        system_message: Optional[str] = None
    ):
        if not GENAI_AVAILABLE:
            raise ImportError("google-generativeai package not installed. Install with: pip install google-generativeai")
        
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.model_name = "gemini-1.5-flash"  # default
        self.temperature = 0.7
        self.max_tokens = 8192
        self.top_p = 1.0
        self.top_k = 40
        self._history: List[Dict[str, str]] = []
        
        # Configure the Gemini API
        genai.configure(api_key=api_key)
        self._model = None
    
    def with_model(self, provider: str, model_name: str):
        """Set the model provider and name. Returns self for chaining."""
        self.model_name = model_name
        # Map provider/model to actual Gemini model names
        if provider == "gemini":
            if "flash" in model_name.lower():
                self.model_name = "gemini-1.5-flash"
            elif "pro" in model_name.lower():
                self.model_name = "gemini-1.5-pro"
            else:
                self.model_name = model_name
        return self
    
    def _build_model(self):
        """Create the GenerativeModel with current configuration"""
        generation_config = genai.types.GenerationConfig(
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
            top_p=self.top_p,
            top_k=self.top_k,
        )
        
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=generation_config,
            system_instruction=self.system_message
        )
        return model
    
    async def send_message(self, message: UserMessage) -> str:
        """
        Send a message and get a response.
        
        Args:
            message: UserMessage object with text content
            
        Returns:
            Response text as string
        """
        try:
            model = self._build_model()
            
            # Build conversation history
            contents = []
            for msg in self._history:
                contents.append({"role": msg["role"], "parts": [msg["content"]]})
            contents.append({"role": "user", "parts": [message.text]})
            
            # Generate response
            response = await self._generate_async(model, contents)
            
            # Update history
            self._history.append({"role": "user", "content": message.text})
            self._history.append({"role": "model", "content": response})
            
            return response
            
        except Exception as e:
            logger.error(f"Gemini chat failed: {e}")
            raise
    
    async def _generate_async(self, model, contents):
        """Async wrapper for Gemini generation"""
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _generate():
            response = model.generate_content(contents)
            return response.text if response.text else ""
        
        return await asyncio.get_event_loop().run_in_executor(None, _generate)
    
    def set_temperature(self, temperature: float):
        self.temperature = temperature
        return self
    
    def set_max_tokens(self, max_tokens: int):
        self.max_tokens = max_tokens
        return self


# =============================================================================
# Backwards compatibility exports
# =============================================================================

# Export the classes for direct import
__all__ = [
    "OpenAISpeechToText",
    "LlmChat", 
    "UserMessage",
]

# For backwards compatibility with existing imports
class LlmChatWrapper:
    """Wrapper to match emergentintegrations.llm.chat.LlmChat interface exactly"""
    pass


# Module-level access for backwards compatibility
llm = type('llm', (), {
    'chat': type('chat', (), {
        'LlmChat': LlmChat,
        'UserMessage': UserMessage,
    }),
    'openai': type('openai', (), {
        'speech_to_text': type('speech_to_text', (), {
            'OpenAISpeechToText': OpenAISpeechToText,
        })
    })
})()


# For direct imports like:
# from emergentintegrations.llm.chat import LlmChat, UserMessage
# from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
__all__ = ['LlmChat', 'UserMessage', 'OpenAISpeechToText']


# For compatibility with: from emergentintegrations.llm.chat import LlmChat, UserMessage
# We need to make the classes available at the module level when imported as:
# from emergentintegrations.llm.chat import LlmChat, UserMessage
import sys
current_module = sys.modules[__name__]
current_module.LlmChat = LlmChat
current_module.UserMessage = UserMessage

# For the openai.speech_to_text submodule
openai_module = type('openai', (), {})
speech_to_text_module = type('speech_to_text', (), {})
speech_to_text_module.OpenAISpeechToText = OpenAISpeechToText
openai_module.speech_to_text = speech_to_text_module

# Make available for: from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
llm_module = type('llm', (), {})
llm_module.chat = type('chat', (), {'LlmChat': LlmChat, 'UserMessage': UserMessage})
llm_module.openai = openai_module

# Make available for: from emergentintegrations.llm import chat
current_module.llm = llm_module