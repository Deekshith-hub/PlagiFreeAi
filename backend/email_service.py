import resend
import os
from typing import Optional
import logging

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
APP_URL = os.environ.get('APP_URL', 'http://localhost:3000')

if RESEND_API_KEY and RESEND_API_KEY != 're_demo_key_replace_in_production':
    resend.api_key = RESEND_API_KEY

def send_verification_email(to_email: str, verification_token: str) -> bool:
    """Send email verification link"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_demo_key_replace_in_production':
        logger.warning(f"Email sending skipped - no valid API key. Verification link: {APP_URL}/verify-email?token={verification_token}")
        print(f"\n=== EMAIL VERIFICATION LINK (for testing) ===")
        print(f"To: {to_email}")
        print(f"Link: {APP_URL}/verify-email?token={verification_token}")
        print(f"=========================================\n")
        return True
    
    try:
        verification_link = f"{APP_URL}/verify-email?token={verification_token}"
        
        params = {
            "from": "PlagiFree AI <noreply@plagifree.ai>",
            "to": [to_email],
            "subject": "Verify your email - PlagiFree AI",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Welcome to PlagiFree AI!</h2>
                <p>Thank you for signing up. Please verify your email address to start rewriting text.</p>
                <div style="margin: 30px 0;">
                    <a href="{verification_link}" 
                       style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 25px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                    If you didn't create this account, you can safely ignore this email.
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                    This link will expire in 24 hours.
                </p>
            </div>
            """
        }
        
        response = resend.Emails.send(params)
        logger.info(f"Verification email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send verification email: {str(e)}")
        # Print to console as fallback
        print(f"\n=== EMAIL VERIFICATION LINK (fallback) ===")
        print(f"To: {to_email}")
        print(f"Link: {APP_URL}/verify-email?token={verification_token}")
        print(f"=========================================\n")
        return True  # Return True so signup doesn't fail

def send_owner_setup_reminder(to_email: str) -> bool:
    """Send reminder email to owner to complete setup"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_demo_key_replace_in_production':
        logger.warning("Owner setup reminder email skipped - no valid API key")
        return True
    
    try:
        params = {
            "from": "PlagiFree AI <noreply@plagifree.ai>",
            "to": [to_email],
            "subject": "Complete Your Payment Setup - PlagiFree AI",
            "html": """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Complete Your Payment Setup</h2>
                <p>To start accepting payments from users, please complete your payment configuration.</p>
                <p>Login to your admin account and navigate to Settings > Payment Setup</p>
                <div style="margin: 30px 0;">
                    <a href="{APP_URL}/admin/setup" 
                       style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 25px; display: inline-block;">
                        Complete Setup
                    </a>
                </div>
            </div>
            """
        }
        
        response = resend.Emails.send(params)
        return True
    except Exception as e:
        logger.error(f"Failed to send owner setup reminder: {str(e)}")
        return False
