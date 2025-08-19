import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/helper';
import { ChatSession, IChatMessage } from "../models/chatbot.model";
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read chatbot data from JSON file
const chatbotDataPath = join(__dirname, '../../../../src/api/utils/chatbotData.json');
const chatbotData = JSON.parse(readFileSync(chatbotDataPath, 'utf8'));

// Single API endpoint to start chat and handle all interactions
const startChat = async (req: Request, res: Response): Promise<any> => {
    try {
        const { name, message, sessionId } = req.body;
        
        // If no sessionId, start a new chat
        if (!sessionId) {
            if (!name) {
                return sendError(res, "Name is required to start chat", 400);
            }

            const newSessionId = uuidv4();
            const initialMessage: IChatMessage = {
                message: chatbotData.greeting.message,
                timestamp: new Date(),
                isUser: false
            };

            const newSession = await ChatSession.create({
                userId: `user_${Date.now()}`, // Generate a simple user ID
                sessionId: newSessionId,
                messages: [initialMessage],
                currentState: 'waiting_for_name',
                userName: name // Store the user's name
            });

            return sendSuccess(res, {
                sessionId: newSessionId,
                message: initialMessage.message,
                currentState: 'waiting_for_name',
                userName: name
            }, "Chat session started successfully", 201);
        }

        // If sessionId exists, process the message
        const session = await ChatSession.findOne({ sessionId });
        if (!session) {
            return sendError(res, "Chat session not found", 404);
        }

        // Add user message to session
        const userMessage: IChatMessage = {
            message: message || name,
            timestamp: new Date(),
            isUser: true
        };

        session.messages.push(userMessage);

        // Process the message and get bot response
        const botResponse = await processUserInput(session, message || name);
        
        // Add bot response to session
        const botMessage: IChatMessage = {
            message: botResponse.message,
            timestamp: new Date(),
            isUser: false,
            options: botResponse.options
        };

        session.messages.push(botMessage);
        session.currentState = botResponse.nextState || session.currentState;
        await session.save();

        return sendSuccess(res, {
            message: botResponse.message,
            options: botResponse.options,
            details: botResponse.details,
            currentState: session.currentState,
            sessionId,
            userName: session.userName
        }, "Message processed successfully", 200);

    } catch (error) {
        console.error('Chat error:', error);
        return sendError(res, "Failed to process chat", 500, error);
    }
};

// Process user input and return appropriate response
const processUserInput = async (session: any, userInput: string): Promise<any> => {
    const currentState = session.currentState;
    let response: any = {};

    try {
        switch (currentState) {
            case 'waiting_for_name':
                response = handleNameResponse(session, userInput);
                break;
            case 'main_menu':
                response = processMainMenuSelection(session, userInput);
                break;
            case 'products_submenu':
                response = processProductsSubmenu(session, userInput);
                break;
            case 'wifi_complaints_submenu':
                response = processWifiComplaintsSubmenu(session, userInput);
                break;
            case 'cctv_complaints_submenu':
                response = processCctvComplaintsSubmenu(session, userInput);
                break;
            case 'wifi_application_submenu':
                response = processWifiApplicationSubmenu(session, userInput);
                break;
            default:
                response = handleDefaultResponse(userInput);
        }

        return response;
    } catch (error) {
        console.error('Process user input error:', error);
        return {
            message: chatbotData.general_responses.invalid_option,
            options: ['Main Menu', 'Help'],
            nextState: 'main_menu'
        };
    }
};

// Handle name response and provide personalized greeting
const handleNameResponse = (session: any, userInput: string): any => {
    const name = userInput.trim();
    
    if (name && name.length > 0) {
        // Update session with the user's name
        session.userName = name;
        
        // Return personalized greeting
        const personalizedMessage = chatbotData.personalized_greeting.message.replace('{name}', name);
        
        return {
            message: personalizedMessage,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: "Please provide your name so I can assist you better.",
        nextState: 'waiting_for_name'
    };
};

// Process main menu selection
const processMainMenuSelection = (session: any, userInput: string): any => {
    const input = userInput.toLowerCase().trim();
    
    if (input === '1' || input.includes('product')) {
        return {
            message: chatbotData.main_menu['1'].message,
            options: chatbotData.main_menu['1'].options,
            nextState: 'products_submenu'
        };
    } else if (input === '2' || input.includes('wifi') && input.includes('complaint')) {
        return {
            message: chatbotData.main_menu['2'].message,
            options: chatbotData.main_menu['2'].options,
            nextState: 'wifi_complaints_submenu'
        };
    } else if (input === '3' || input.includes('cctv') && input.includes('complaint')) {
        return {
            message: chatbotData.main_menu['3'].message,
            options: chatbotData.main_menu['3'].options,
            nextState: 'cctv_complaints_submenu'
        };
    } else if (input === '4' || input.includes('apply') && input.includes('wifi')) {
        return {
            message: chatbotData.main_menu['4'].message,
            options: chatbotData.main_menu['4'].options,
            nextState: 'wifi_application_submenu'
        };
    } else if (input.includes('main menu') || input.includes('back')) {
        return {
            message: `Hello ${session?.userName || 'there'}! How can I help you today?`,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    } else if (input.includes('help')) {
        return {
            message: chatbotData.general_responses.help,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: chatbotData.general_responses.invalid_option,
        options: chatbotData.personalized_greeting.options,
        nextState: 'main_menu'
    };
};

// Process products submenu
const processProductsSubmenu = (session: any, userInput: string): any => {
    const input = userInput.toLowerCase().trim();
    
    if (input === '1' || input.includes('buy')) {
        const data = chatbotData.products_submenu['1'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '2' || input.includes('delivery')) {
        const data = chatbotData.products_submenu['2'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '3' || input.includes('info')) {
        const data = chatbotData.products_submenu['3'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input.includes('back') || input.includes('products')) {
        return {
            message: chatbotData.main_menu['1'].message,
            options: chatbotData.main_menu['1'].options,
            nextState: 'products_submenu'
        };
    } else if (input.includes('main menu')) {
        return {
            message: `Hello ${session?.userName || 'there'}! How can I help you today?`,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: chatbotData.general_responses.invalid_option,
        options: chatbotData.products_submenu['1'].options,
        nextState: 'products_submenu'
    };
};

// Process WiFi complaints submenu
const processWifiComplaintsSubmenu = (session: any, userInput: string): any => {
    const input = userInput.toLowerCase().trim();
    
    if (input === '1' || input.includes('slow')) {
        const data = chatbotData.wifi_complaints_submenu['1'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '2' || input.includes('drop')) {
        const data = chatbotData.wifi_complaints_submenu['2'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '3' || input.includes('connect')) {
        const data = chatbotData.wifi_complaints_submenu['3'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '4' || input.includes('other')) {
        const data = chatbotData.wifi_complaints_submenu['4'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input.includes('back') || input.includes('wifi')) {
        return {
            message: chatbotData.main_menu['2'].message,
            options: chatbotData.main_menu['2'].options,
            nextState: 'wifi_complaints_submenu'
        };
    } else if (input.includes('main menu')) {
        return {
            message: `Hello ${session?.userName || 'there'}! How can I help you today?`,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: chatbotData.general_responses.invalid_option,
        options: chatbotData.wifi_complaints_submenu['1'].options,
        nextState: 'wifi_complaints_submenu'
    };
};

// Process CCTV complaints submenu
const processCctvComplaintsSubmenu = (session: any, userInput: string): any => {
    const input = userInput.toLowerCase().trim();
    
    if (input === '1' || input.includes('camera') && input.includes('work')) {
        const data = chatbotData.cctv_complaints_submenu['1'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '2' || input.includes('quality')) {
        const data = chatbotData.cctv_complaints_submenu['2'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '3' || input.includes('recording')) {
        const data = chatbotData.cctv_complaints_submenu['3'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '4' || input.includes('other')) {
        const data = chatbotData.cctv_complaints_submenu['4'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input.includes('back') || input.includes('cctv')) {
        return {
            message: chatbotData.main_menu['3'].message,
            options: chatbotData.main_menu['3'].options,
            nextState: 'cctv_complaints_submenu'
        };
    } else if (input.includes('main menu')) {
        return {
            message: `Hello ${session?.userName || 'there'}! How can I help you today?`,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: chatbotData.general_responses.invalid_option,
        options: chatbotData.cctv_complaints_submenu['1'].options,
        nextState: 'cctv_complaints_submenu'
    };
};

// Process WiFi application submenu
const processWifiApplicationSubmenu = (session: any, userInput: string): any => {
    const input = userInput.toLowerCase().trim();
    
    if (input === '1' || input.includes('requirement') || input.includes('document')) {
        const data = chatbotData.wifi_application_submenu['1'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '2' || input.includes('process')) {
        const data = chatbotData.wifi_application_submenu['2'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '3' || input.includes('timeline') || input.includes('installation')) {
        const data = chatbotData.wifi_application_submenu['3'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input === '4' || input.includes('pricing') || input.includes('plan')) {
        const data = chatbotData.wifi_application_submenu['4'];
        return {
            message: data.message,
            details: data.details,
            options: data.options,
            nextState: data.nextState
        };
    } else if (input.includes('back') || input.includes('wifi') && input.includes('application')) {
        return {
            message: chatbotData.main_menu['4'].message,
            options: chatbotData.main_menu['4'].options,
            nextState: 'wifi_application_submenu'
        };
    } else if (input.includes('main menu')) {
        return {
            message: `Hello ${session?.userName || 'there'}! How can I help you today?`,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: chatbotData.general_responses.invalid_option,
        options: chatbotData.wifi_application_submenu['1'].options,
        nextState: 'wifi_application_submenu'
    };
};

// Handle default response
const handleDefaultResponse = (userInput: string): any => {
    const input = userInput.toLowerCase().trim();
    
    if (input.includes('thank')) {
        return {
            message: chatbotData.general_responses.thank_you,
            options: ['Yes, please', 'No, thank you'],
            nextState: 'main_menu'
        };
    } else if (input.includes('bye') || input.includes('goodbye')) {
        return {
            message: chatbotData.general_responses.goodbye,
            options: [],
            nextState: 'ended'
        };
    } else if (input.includes('help')) {
        return {
            message: chatbotData.general_responses.help,
            options: chatbotData.personalized_greeting.options,
            nextState: 'main_menu'
        };
    }

    return {
        message: chatbotData.general_responses.invalid_option,
        options: chatbotData.personalized_greeting.options,
        nextState: 'main_menu'
    };
};

export {
    startChat
};
