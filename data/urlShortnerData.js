exports.UrlShortnerdata = {
  title: "Url retargeting Consent form",
  branding: 1,
  og_tags: null,
  favicon: null,
  facebook_pixel_tracking_id: "123",
  tracking_list: [
    {
      position: "Head",
      type: "Google Analytics",
      snippet_code: "UA-183639594-1",
    },
    {
      position: "Head",
      type: "Facebook Pixel",
      snippet_code: "123",
    },
  ],
  gdpr_popup: {
    link_to_privacy_policy: "https://https://www.linkjoy.io/privacy-policy",
    popup_content: {
      header_text: "Your privacy matters to us.",
      paragraph_text:
        '<p><span style="color: rgb(17, 17, 17);">To enhance your experience and provide superior service, our partners utilize third-party cookies for personalized content, targeted advertisements, and traffic analysis. By continuing, you agree to the use of this technology across the web</span></p><p><br></p><p><strong style="color: rgb(17, 17, 17);">If you continue, you consent to the use of this technology across the web.</strong><span class="ql-emojiblot" data-name="pray">\ufeff<span contenteditable="false"><span class="ap ap-pray">🙏</span></span>\ufeff</span></p>',
      hyperlink_text: "Click here for more information",
      allow_button_text: "Accept",
      decline_button_text: "Deny",
    },
  },
};
