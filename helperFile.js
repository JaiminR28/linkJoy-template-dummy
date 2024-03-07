const { URL } = require("url");

const constants = {
	DEEP_LINK_APPS: {
		facebook: "https://www.facebook.com/",
		youtube: "https://www.youtube.com/",
		linkedin: "https://www.linkedin.com/in/",
		twitch: "https://www.twitch.tv/",
	},
};

const pagebuilderDelimiterSvg = (key) => {
	const pagebuilderDelimiterSvg = {
		2: "",
		3: "<img class='svg' src='sprite/svg/chevron-up-outline.svg' height='25px'>",
		4: "<img class='svg' src='sprite/svg/star-outline.svg' height='25px'>",
		5: "<img class='svg' src='sprite/svg/ellipse-outline.svg' height='25px'>",
		6: "<img class='svg' src='sprite/svg/analytics-outline-1.svg' height='25px'>",
		7: "<img class='svg' src='sprite/svg/checkmark-circle-outline.svg' height='25px'>",
		8: "<img class='svg' src='sprite/svg/eye-outline.svg' height='25px'>",
		9: "<img class='svg' src='sprite/svg/flash-outline.svg' height='25px'>",
		10: "<img class='svg' src='sprite/svg/sync-outline.svg' height='25px'>",
		11: "<img class='svg' src='sprite/svg/remove-circle-outline.svg' height='25px'>",
		12: "<img class='svg' src='sprite/svg/sunny-outline.svg' height='25px'>",
		13: "<img class='svg' src='sprite/svg/snow-outline.svg' height='25px'>",
	};

	return pagebuilderDelimiterSvg[key]
		? `<span>${pagebuilderDelimiterSvg[key]}</span>`
		: "";
};

const pagebuilderSocialLink = (useragent, type, page_id, text = "") => {
	const deviceInfo = useragent;

	if (deviceInfo.isAndroid || deviceInfo.isAndroidNative) {
		if (constants.DEEP_LINK_APPS[type]) {
			page_id = page_id.replace(constants.DEEP_LINK_APPS[type], "");
		}

		const pagebuilderSocials = {
			facebook: `https://www.facebook.com/${page_id}`,
			instagram: `intent://www.instagram.com/${page_id}#Intent;package=com.instagram.android;scheme=https;end`,
			twitter: `intent://twitter.com/${page_id}#Intent;package=com.twitter.android;scheme=https;end`,
			youtube: `intent://www.youtube.com/${page_id}#Intent;package=com.google.android.youtube;scheme=https;end`,
			linkedin: `intent://www.linkedin.com/in/${page_id}#Intent;package=com.linkedin.android;scheme=https;end`,
			pinterest: `pinterest://pinterest.com/${page_id}`,
			tumblr: `https://${page_id}.tumblr.com`,
			patreon: `https://patreon.com/${page_id}`,
			vk: `intent://vk.com/${page_id}#Intent;package=com.vkontakte.android;scheme=vkontakte;end`,
			snapchat: `intent://add/${page_id}#Intent;scheme=snapchat;package=com.snapchat.android;end`,
			github: `https://github.com/${page_id}`,
			whatsapp: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
				page_id
			)}&text=${text}`,
			telegram: `intent://resolve?domain=${page_id}#Intent;package=org.telegram.messenger;scheme=tg;end`,
			skype: `skype:${page_id}`,
			mail: `mailto:${page_id}?subject=${text}`,
			phone: `tel:${encodeURIComponent(page_id)}`,
			viber: `viber://chat?number=${encodeURIComponent(page_id)}`,
			messenger: `intent://user/${page_id}/#Intent;scheme=fb-messenger;package=com.facebook.orca;end`,
			discord: page_id,
			tiktok: page_id,
			twitch: `twitch://stream/${page_id}`,
		};
		return pagebuilderSocials[type] || "#";
	} else if (deviceInfo.isiPhone || deviceInfo.isiPad || deviceInfo.isiPod) {
		if (constants.DEEP_LINK_APPS[type]) {
			page_id = page_id.replace(constants.DEEP_LINK_APPS[type], "");
		}

		const pagebuilderSocials = {
			facebook: `https://www.facebook.com/${page_id}`,
			instagram: `instagram://user?username=${page_id}`,
			twitter: `twitter://user?screen_name=${page_id}`,
			youtube: `vnd.youtube://www.youtube.com/${page_id}`,
			linkedin: `linkedin://in/${page_id}`,
			pinterest: `pinterest://user/${page_id}`,
			tumblr: `https://${page_id}.tumblr.com`,
			patreon: `https://patreon.com/${page_id}`,
			vk: `vk://vk.com/${page_id}`,
			snapchat: `snapchat://add/${page_id}`,
			github: `https://github.com/${page_id}`,
			whatsapp: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
				page_id
			)}&text=${text}`,
			telegram: `tg://resolve?domain=${page_id}`,
			skype: `skype:${page_id}`,
			mail: `mailto:${page_id}?subject=${text}`,
			phone: `tel:${encodeURIComponent(page_id)}`,
			viber: `viber://chat?number=${encodeURIComponent(page_id)}`,
			messenger: `fb-messenger-public://user-thread/${page_id}/`,
			discord: page_id,
			tiktok: page_id,
			twitch: `twitch://stream/${page_id}`,
		};
		return pagebuilderSocials[type] || "#";
	} else {
		const pagebuilderSocials = {
			facebook: page_id,
			instagram: `https://instagram.com/${page_id}`,
			twitter: `https://twitter.com/${page_id}`,
			youtube: page_id,
			linkedin: page_id,
			pinterest: `https://pinterest.com/${page_id}`,
			tumblr: `https://${page_id}.tumblr.com`,
			patreon: `https://patreon.com/${page_id}`,
			vk: `https://vk.com/${page_id}`,
			snapchat: `https://snapchat.com/add/${page_id}`,
			github: `https://github.com/${page_id}`,
			whatsapp: `https://api.whatsapp.com/send?phone=${encodeURIComponent(
				page_id
			)}&text=${text}`,
			telegram: `https://t.me/${page_id}`,
			skype: `skype:${page_id}`,
			mail: `mailto:${page_id}?subject=${text}`,
			phone: `tel:${encodeURIComponent(page_id)}`,
			viber: `viber://chat?number=${encodeURIComponent(page_id)}`,
			messenger: `https://www.messenger.com/t/${page_id}`,
			discord: page_id,
			tiktok: page_id,
			twitch: page_id,
		};
		return pagebuilderSocials[type] || "#";
	}
};

function processUrl(originalUrl, scheme) {
	const parsedUrl = new URL(originalUrl);

	// Check if the URL already has a scheme
	if (!parsedUrl.protocol) {
		// If it doesn't have a scheme, prepend the specified scheme
		parsedUrl.protocol = `${scheme}:`;
	}

	// Convert the URL object back to a string
	const modifiedUrl = parsedUrl.toString();

	return modifiedUrl;
}

const giveDeepLinkUrl = (useragent, url, scheme = "https://") => {
	// console.log({ url });
	// console.log({ useragent });
	const link = processUrl(url, scheme);

	const deepLink = null; // TEMP

	// const deepLink = deepLnkApEvntDb.findOne({
	// 	where: db.sequelize.literal("? LIKE CONCAT('%', `domain_url`, '%'))"),
	// 	replacements: [link],
	// 	include: {
	// 		model: db.deep_link_apps,
	// 		as: "App",
	// 	},
	// });

	if (deepLink) {
		const userName = link.replace(deepLink.domain_url, "");

		if (useragent.isAndroid) {
			if (deepLink.App.app_name === "WhatsApp") {
				const substr = link.replace(deepLink.domain_url, "");

				let androidLink = "";
				if (substr.includes("'?text='")) {
					let substrParts = substr.split("?text=");
					let number = substrParts[0];
					let textMsg = substrParts[1];

					// Splitting the deepLink.event_slug based on ','
					let slugParts = deepLink.event_slug.split(",");
					let slugNumber = slugParts[0];
					let slugMsg = slugParts[1];

					// Replacing values in the android link
					androidLink = deepLink.android_link.replace(
						slugNumber,
						number
					);
					androidLink = androidLink.replace(slugMsg, textMsg);
				} else {
					androidLink = deepLink.android_link.replace(
						"phone_number&text=text_message",
						substr
					);
				}
				return androidLink;
			} else if (deepLink.App.app_name === "Slack") {
				const substr = link.replace(deepLink.domain_url, "");
				const teamId = substr.split("/")[0];
				const channelId = substr.split("/")[1];

				const slugTeamSplit = deepLink.event_slug.split(",");
				const slugTeam = slugTeamSplit[0];
				const slugChannel = slugTeamSplit[1];

				let androidLink = deepLink.android_link.replace(
					slugTeam,
					teamId
				);
				androidLink = androidLink.replace(slugChannel, channelId);

				return androidLink;
			} else {
				let androidLink = deepLink.android_link.replace(
					deepLink.event_slug,
					userName
				);
				return androidLink;
			}
		} else if (useragent.isiPhone || useragent.isiPod || useragent.isiPad) {
			let iosLink = null;
			if (deepLink.App.app_name === "WhatsApp") {
				const substr = link.replace(deepLink.domain_url, "");
				if (substr.includes("?text=")) {
					const substrSplit = substr.split("?text=");
					const number = substrSplit[0];
					const textMsg = substrSplit[1];

					const slugSplit = deepLink.event_slug.split(",");
					const slugNumber = slugSplit[0];
					const slugMsg = slugSplit[1];

					iosLink = deepLink.ios_link.replace(slugNumber, number);
					iosLink = iosLink.replace(slugMsg, textMsg);
				} else {
					iosLink = deepLink.android_link.replace(
						"phone_number&text=text_message",
						substr
					);
				}
				return iosLink;
			} else if (deepLink.App.app_name === "Slack") {
				const substr = link.replace(deepLink.domain_url, "");
				const teamId = substr.split("/")[0];
				const channelId = substr.split("/")[1];

				const slugTeamSplit = deepLink.event_slug.split(",");
				const slugTeam = slugTeamSplit[0];
				const slugChannel = slugTeamSplit[1];

				iosLink = deepLink.iosLink.replace(slugTeam, teamId);
				iosLink = iosLink.replace(slugChannel, channelId);
				return iosLink;
			} else if (deepLink.App.app_name === "Airbnb") {
				const n = link.indexOf("/", 8);
				const userName = link.substring(n + 1);

				iosLink = deepLink.ios_link.replace(
					deepLink.event_slug,
					userName
				);
				return iosLink;
			}
		} else {
			return link;
		}
	} else {
		return link;
	}
};

const getValidUrl = (url) => {
	const scheme = "https://";
	const parsedUrl = new URL(url);

	if (!parsedUrl.protocol) {
		return scheme + url;
	} else {
		return url;
	}
};

function stripTags(input) {
	return input.replace(/<[^>]*>/g, "");
}

const blockHideOrShowWithSchedule = (
	type,
	isHide,
	isSchedule,
	startEndDates,
	time = {}
) => {
	if (isHide === true) return false;

	if (isSchedule === true) {
		if (startEndDates.start && startEndDates.end) {
			const timeZone = time.timezone || "Asia/Calcutta";
			const startTime = time.start || "00:00:00";
			const endTime = time.end || "00:00:00";

			const todayDate = DateTime.now().setZone(timeZone);
			const startDate = DateTime.fromFormat(
				startEndDates.start + " " + startTime,
				"d.M.yyyy H:mm:ss",
				{ zone: timeZone }
			);
			const endDate = DateTime.fromFormat(
				startEndDates.end + " " + endTime,
				"d.M.yyyy H:mm:ss",
				{ zone: timeZone }
			);

			if (todayDate >= startDate && todayDate <= endDate) {
				return true;
			} else {
				return false;
			}
		} else {
			return true;
		}
	}
	return true;
};

const pagebuilderThemes = (key, name, opacity = null) => {
	const opacity_style = opacity !== 10 ? "opacity:." + opacity + ";" : "";

	if (name && name.startsWith("http")) {
		return `<style>.section-init:before { ${opacity_style} background-image: url(${name}); position: fixed; content: " "; display: block; top: 0px; left: 0px; right: 0px; bottom: 0px; z-index: -10; background-size: cover; overflow-y: auto; } </style>`;
	} else if (
		(name && name.substring(2, 3) === "jpg") ||
		(name &&
			name.substring(3, 3) === "jpg" &&
			name.substring(0, 4) === "http")
	) {
		return `<style>.section-init:before{ background-image:url(/themes/ ${name}); position: fixed; content: " ";display: block;top: 0px;left: 0px;right: 0px;bottom: 0px;z-index: -10;background-size: cover;overflow-y: auto;}</style>';`;
	} else {
		return `<style>.section-init{ background: ${name}}</style>`;
	}
};

module.exports = {
	pagebuilderThemes,
	blockHideOrShowWithSchedule,
	getValidUrl,
	giveDeepLinkUrl,
	stripTags,
	pagebuilderSocialLink,
	pagebuilderDelimiterSvg,
};
