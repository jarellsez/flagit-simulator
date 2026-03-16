import email
from email.policy import default
from bs4 import BeautifulSoup
import re

class EmailParserUtility:
    """
    Strips raw email strings down to structural parts, cleans HTML, and extracts hyperlinks
    to be fed individually to the FlagIt AI Pipeline.
    """
    
    @staticmethod
    def parse_raw_email(raw_email_string: str) -> dict:
        # Parse the raw bytes/string into an EmailMessage object
        msg = email.message_from_string(raw_email_string, policy=default)
        
        parsed_data = {
            'subject': msg.get('Subject', ''),
            'from': msg.get('From', ''),
            'to': msg.get('To', ''),
            'platform': msg.get('Platform', 'email').lower(),
            'body': '',
            'urls': [],
            'has_attachment': False
        }
        
        # Fallback for non-MIME strings starting with Subject:
        if not parsed_data['subject']:
            subj_match = re.search(r'^Subject:\s*(.*)', raw_email_string, re.IGNORECASE | re.MULTILINE)
            if subj_match:
                parsed_data['subject'] = subj_match.group(1).strip()
        
        html_content = ""
        text_content = ""
        
        # Check standard attachment headers in raw text to support dummy payloads
        if 'Attachments:' in raw_email_string or 'attached' in raw_email_string.lower():
            parsed_data['has_attachment'] = True
            
        # Traverse payload to gracefully handle Multipart emails (HTML vs PlainText)
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))
                
                # Check for actual MIME attachments
                if "attachment" in content_disposition:
                    parsed_data['has_attachment'] = True
                    continue
                    
                if content_type == "text/plain":
                    text_content += part.get_payload(decode=True).decode(part.get_content_charset('utf-8'), errors='ignore')
                elif content_type == "text/html":
                    html_content += part.get_payload(decode=True).decode(part.get_content_charset('utf-8'), errors='ignore')
        else:
            # Not multipart
            payload = msg.get_payload(decode=True).decode(msg.get_content_charset('utf-8') or 'utf-8', errors='ignore')
            if msg.get_content_type() == 'text/html':
                html_content = payload
            else:
                text_content = payload
                
        # If HTML exists, use BeautifulSoup to parse Links and Strip Tags
        if html_content:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract all anchor tags with hrefs
            for a_tag in soup.find_all('a', href=True):
                parsed_data['urls'].append(a_tag['href'])
                
            # Strip HTML tags to leave clean text for BERT
            parsed_data['body'] = soup.get_text(separator=' ', strip=True)
        else:
            # Fallback to Regex for plain-text link extraction
            parsed_data['body'] = text_content.strip()
            # More comprehensive URL matching pattern
            url_pattern = r'https?://[^\s<>"\']+'
            parsed_data['urls'].extend(re.findall(url_pattern, text_content))
            
        # Deduplicate URLs
        parsed_data['urls'] = list(set(parsed_data['urls']))
        
        return parsed_data
