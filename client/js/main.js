import './NodeCrypt.js';
import './util.webrtc.js';
import {
	setupFileSend,
	handleFileMessage,
	downloadFile
} from './util.file.js';

import {
	setupImagePaste
} from './util.image.js';

import {
	setupEmojiPicker
} from './util.emoji.js';

import {
	openSettingsPanel,
	closeSettingsPanel,
	initSettings,
	notifyMessage
} from './util.settings.js';
import { t, updateStaticTexts } from './util.i18n.js';

import {
	initTheme
} from './util.theme.js';

import {
	$,
	$id,
	removeClass
} from './util.dom.js';

import {
	roomsData,
	activeRoomIndex,
	joinRoom
} from './room.js';

import {
	addMsg,
	addOtherMsg,
	addSystemMsg,
	setupImagePreview,
	setupInputPlaceholder,
	autoGrowInput
} from './chat.js';

import {
	renderUserList,
	renderMainHeader,
	setupMoreBtnMenu,
	preventSpaceInput,
	loginFormHandler,
	openLoginModal,
	setupTabs,
	autofillRoomPwd,
	generateLoginForm,
	initLoginForm,
	initFlipCard
} from './ui.js';

window.config = {
	wsAddress: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`,
	debug: true
};

initSettings();
updateStaticTexts();

window.addSystemMsg = addSystemMsg;
window.addOtherMsg = addOtherMsg;
window.joinRoom = joinRoom;
window.notifyMessage = notifyMessage;
window.setupEmojiPicker = setupEmojiPicker;
window.handleFileMessage = handleFileMessage;
window.downloadFile = downloadFile;

window.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => {
		document.body.classList.remove('preload');
	}, 300);

	initLoginForm();

	const loginForm = $id('login-form');

	if (loginForm) {
		loginForm.addEventListener('submit', loginFormHandler(null));
	}

	const joinBtn = $('.join-room');
	if (joinBtn) {
		joinBtn.onclick = openLoginModal;
	}

	preventSpaceInput($id('userName'));
	preventSpaceInput($id('roomName'));
	preventSpaceInput($id('password'));

	initFlipCard();

	autofillRoomPwd();
	setupInputPlaceholder();
	setupMoreBtnMenu();
	setupImagePreview();
	setupEmojiPicker();

	initTheme();

	const settingsBtn = $id('settings-btn');
	if (settingsBtn) {
		settingsBtn.onclick = (e) => {
			e.stopPropagation();
			openSettingsPanel();
		};
	}

	const settingsBackBtn = $id('settings-back-btn');
	if (settingsBackBtn) {
		settingsBackBtn.onclick = (e) => {
			e.stopPropagation();
			closeSettingsPanel();
		};
	}

	const input = document.querySelector('.input-message-input');

	const imagePasteHandler = setupImagePaste('.input-message-input');

	if (input) {
		input.focus();
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		});
	}

	function sendMessage() {
		const text = input.innerText.trim();
		const images = imagePasteHandler ? imagePasteHandler.getCurrentImages() : [];

		if (!text && images.length === 0) return;
		const rd = roomsData[activeRoomIndex];

		if (rd && rd.chat) {
			if (images.length > 0) {
				const messageContent = {
					text: text || '',
					images: images
				};

				if (rd.privateChatTargetId) {
					const targetClient = rd.chat.channel[rd.privateChatTargetId];
					if (targetClient && targetClient.shared) {
						const clientMessagePayload = {
							a: 'm',
							t: 'image_private',
							d: messageContent
						};
						const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
						const serverRelayPayload = {
							a: 'c',
							p: encryptedClientMessage,
							c: rd.privateChatTargetId
						};
						const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
						rd.chat.sendMessage(encryptedMessageForServer);
						addMsg(messageContent, false, 'image_private');
					} else {
						addSystemMsg(`${t('system.private_message_failed', 'Cannot send private message to')} ${rd.privateChatTargetName}. ${t('system.user_not_connected', 'User might not be fully connected.')}`);
					}
				} else {
					rd.chat.sendChannelMessage('image', messageContent);
					addMsg(messageContent, false, 'image');
				}

				imagePasteHandler.clearImages();
			} else if (text) {
				if (rd.privateChatTargetId) {
					const targetClient = rd.chat.channel[rd.privateChatTargetId];
					if (targetClient && targetClient.shared) {
						const clientMessagePayload = {
							a: 'm',
							t: 'text_private',
							d: text
						};
						const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
						const serverRelayPayload = {
							a: 'c',
							p: encryptedClientMessage,
							c: rd.privateChatTargetId
						};
						const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
						rd.chat.sendMessage(encryptedMessageForServer);
						addMsg(text, false, 'text_private');
					} else {
						addSystemMsg(`${t('system.private_message_failed', 'Cannot send private message to')} ${rd.privateChatTargetName}. ${t('system.user_not_connected', 'User might not be fully connected.')}`);
					}
				} else {
					rd.chat.sendChannelMessage('text', text);
					addMsg(text);
				}
			}

			input.innerHTML = '';
			if (imagePasteHandler && typeof imagePasteHandler.refreshPlaceholder === 'function') {
				imagePasteHandler.refreshPlaceholder();
			}
			autoGrowInput();
		}
	}

	const sendButton = document.querySelector('.send-message-btn');
	if (sendButton) {
		sendButton.addEventListener('click', sendMessage);
	}

	setupFileSend({
		inputSelector: '.input-message-input',
		attachBtnSelector: '.chat-attach-btn',
		fileInputSelector: '.new-message-wrapper input[type="file"]',
		onSend: (message) => {
			const rd = roomsData[activeRoomIndex];
			if (rd && rd.chat) {
				const userName = rd.myUserName || '';
				const msgWithUser = { ...message, userName };
				if (rd.privateChatTargetId) {
					const targetClient = rd.chat.channel[rd.privateChatTargetId];
					if (targetClient && targetClient.shared) {
						const clientMessagePayload = {
							a: 'm',
							t: msgWithUser.type + '_private',
							d: msgWithUser
						};
						const encryptedClientMessage = rd.chat.encryptClientMessage(clientMessagePayload, targetClient.shared);
						const serverRelayPayload = {
							a: 'c',
							p: encryptedClientMessage,
							c: rd.privateChatTargetId
						};
						const encryptedMessageForServer = rd.chat.encryptServerMessage(serverRelayPayload, rd.chat.serverShared);
						rd.chat.sendMessage(encryptedMessageForServer);

						if (msgWithUser.type === 'file_start') {
							addMsg(msgWithUser, false, 'file_private');
						}
					} else {
						addSystemMsg(`${t('system.private_file_failed', 'Cannot send private file to')} ${rd.privateChatTargetName}. ${t('system.user_not_connected', 'User might not be fully connected.')}`);
					}
				} else {
					rd.chat.sendChannelMessage(msgWithUser.type, msgWithUser);

					if (msgWithUser.type === 'file_start') {
						addMsg(msgWithUser, false, 'file');
					}
				}
			}
		}
	});

	const isMobile = () => window.innerWidth <= 768;

	renderMainHeader();
	renderUserList();
	setupTabs();

	const roomList = $id('room-list');
	const sidebar = $id('sidebar');
	const rightbar = $id('rightbar');
	const sidebarMask = $id('mobile-sidebar-mask');
	const rightbarMask = $id('mobile-rightbar-mask');

	if (roomList) {
		roomList.addEventListener('click', () => {
			if (isMobile()) {
				sidebar?.classList.remove('mobile-open');
				sidebarMask?.classList.remove('active');
			}
		});
	}

	const memberTabs = $id('member-tabs');
	if (memberTabs) {
		memberTabs.addEventListener('click', () => {
			if (isMobile()) {
				removeClass(rightbar, 'mobile-open');
				removeClass(rightbarMask, 'active');
			}
		});
	}
});

window.addEventListener('languageChange', (event) => {
	updateStaticTexts();
});

let dragCounter = 0;
let hasTriggeredAttach = false;

window.addEventListener('fileUploadModalClosed', () => {
	hasTriggeredAttach = false;
});

document.addEventListener('dragenter', (e) => {
	dragCounter++;
	if (!hasTriggeredAttach && e.dataTransfer.items.length > 0) {
		for (let item of e.dataTransfer.items) {
			if (item.kind === 'file') {
				const attachBtn = document.querySelector('.chat-attach-btn');
				if (attachBtn) {
					attachBtn.click();
					hasTriggeredAttach = true;
				}
				break;
			}
		}
	}
});

document.addEventListener('dragleave', (e) => {
	dragCounter--;
	if (dragCounter === 0) {
		hasTriggeredAttach = false;
	}
});

document.addEventListener('dragover', (e) => {
	e.preventDefault();
});

document.addEventListener('drop', (e) => {
	e.preventDefault();
	dragCounter = 0;
	hasTriggeredAttach = false;
});