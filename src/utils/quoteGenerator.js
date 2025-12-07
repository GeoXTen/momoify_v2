import { AttachmentBuilder } from 'discord.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Canvas import - optional feature
// let createCanvas, loadImage, canvasAvailable = false;
// // const { createCanvas, loadImage } = await import('canvas')
// try {
    const canvas = await import('canvas');
    let createCanvas = canvas.createCanvas;
    let loadImage = canvas.loadImage;
    let canvasAvailable = true;
// } catch (error) {
//     // Canvas not available - quote generation will be disabled
// }


// Note: Fonts are registered in src/index.js at bot startup

/**
 * Parse options from message content
 * @param {string} content - The message content after the mention
 * @returns {object} Parsed options
 */
function parseOptions(content) {
    const options = {
        light: false,
        bold: false,
        flip: false,
        colorAvatar: false,
        font: 'DejaVu Sans' // Default font - requires dejavu-sans-fonts package on Linux
    };
    
    if (!content) return options;
    
    const lowerContent = content.toLowerCase();
    const parts = lowerContent.split(/[,\s]+/);
    
    for (const part of parts) {
        if (part === 'light' || part === 'l') {
            options.light = true;
        } else if (part === 'bold' || part === 'b') {
            options.bold = true;
        } else if (part === 'flip' || part === 'f') {
            options.flip = true;
        } else if (part === 'color' || part === 'c') {
            options.colorAvatar = true;
        } else if (part.startsWith('font=')) {
            options.font = part.split('=')[1] || 'Arial';
        }
    }
    
    return options;
}

/**
 * Wrap text to fit within a maximum width
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width in pixels
 * @returns {string[]} Array of wrapped lines
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        // Check if a single word is too long to fit
        const wordMetrics = ctx.measureText(word);
        if (wordMetrics.width > maxWidth) {
            // If current line has content, push it first
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
            
            // Break the long word into smaller parts
            let remainingWord = word;
            while (remainingWord.length > 0) {
                let partialWord = '';
                let i = 0;
                
                // Find the maximum characters that fit
                while (i < remainingWord.length) {
                    const testPartial = partialWord + remainingWord[i];
                    const testMetrics = ctx.measureText(testPartial);
                    
                    if (testMetrics.width > maxWidth && partialWord) {
                        break;
                    }
                    
                    partialWord += remainingWord[i];
                    i++;
                }
                
                // If we couldn't fit even one character, force at least one
                if (partialWord === '' && remainingWord.length > 0) {
                    partialWord = remainingWord[0];
                    i = 1;
                }
                
                lines.push(partialWord);
                remainingWord = remainingWord.substring(i);
            }
            continue;
        }
        
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

/**
 * Generate a quote image from a message
 * @param {Message} message - The Discord message to quote
 * @param {object} options - Generation options
 * @returns {Promise<AttachmentBuilder>} The generated image as an attachment
 */
export async function generateQuote(message, options = {}) {
    // Check if canvas is available
    if (!canvasAvailable) {
        return null;
    }
    
    const {
        light = false,
        bold = false,
        flip = false,
        colorAvatar = false,
        font = 'DejaVu Sans' // Default font - requires dejavu-sans-fonts package on Linux
    } = options;
    
    // Canvas dimensions - split design
    const width = 1200;
    const height = 500;
    const avatarWidth = 450; // Left side for avatar
    // const textWidth = width - avatarWidth; // Right side for text
    
    // Clean up message content - replace Discord mentions with usernames
    let cleanContent = message.content;
    
    // Replace user mentions <@userid> with @username
    const userMentionRegex = /<@!?(\d+)>/g;
    cleanContent = cleanContent.replace(userMentionRegex, (match, userId) => {
        const mentionedUser = message.mentions.users.get(userId);
        return mentionedUser ? `@${mentionedUser.username}` : match;
    });
    
    // Replace channel mentions <#channelid> with #channelname
    const channelMentionRegex = /<#(\d+)>/g;
    cleanContent = cleanContent.replace(channelMentionRegex, (match, channelId) => {
        const mentionedChannel = message.guild?.channels.cache.get(channelId);
        return mentionedChannel ? `#${mentionedChannel.name}` : match;
    });
    
    // Replace role mentions <@&roleid> with @rolename
    const roleMentionRegex = /<@&(\d+)>/g;
    cleanContent = cleanContent.replace(roleMentionRegex, (match, roleId) => {
        const mentionedRole = message.guild?.roles.cache.get(roleId);
        return mentionedRole ? `@${mentionedRole.name}` : match;
    });
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Colors
    const textColor = light ? '#000000' : '#FFFFFF';
    const secondaryColor = light ? '#666666' : '#999999';
    
    // STEP 1: Load and draw square avatar FIRST (fills left side, behind template)
    try {
        const avatarURL = message.author.displayAvatarURL({ extension: 'png', size: 512 });
        const avatar = await loadImage(avatarURL);
        
        // Avatar settings - square, adjusted size and position
        const avatarSize = 540; // Square avatar - bigger (was 570px)
        const avatarX = flip ? width - avatarSize : -45; // Position
        const avatarY = -40; // Top edge with offset
        
        // Create a temporary canvas for the avatar
        const avatarCanvas = createCanvas(avatarSize, avatarSize);
        const avatarCtx = avatarCanvas.getContext('2d');
        
        // Draw avatar as square
        avatarCtx.drawImage(avatar, 0, 0, avatarSize, avatarSize);
        
        // If not colored, apply grayscale
        if (!colorAvatar) {
            const imageData = avatarCtx.getImageData(0, 0, avatarSize, avatarSize);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
            }
            avatarCtx.putImageData(imageData, 0, 0);
        }
        
        // Draw the square avatar on main canvas (BEHIND template)
        ctx.drawImage(avatarCanvas, avatarX, avatarY);
        
    } catch (error) {
        console.error('Error loading avatar:', error);
    }
    
    // STEP 2: Load and draw the template background ON TOP of avatar
    try {
        // Choose template based on light/dark mode
        const templateName = light ? 'quotes_template_light.png' : 'quotes_template.png';
        const templatePath = join(dirname(fileURLToPath(import.meta.url)), '../../' + templateName);
        const template = await loadImage(templatePath);
        
        if (flip) {
            // Flip the template horizontally
            ctx.save();
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(template, 0, 0, width, height);
            ctx.restore();
        } else {
            // Draw template normally ON TOP of avatar
            ctx.drawImage(template, 0, 0, width, height);
        }
    } catch (error) {
        console.error('Error loading template:', error);
        // Fallback to solid background
        const bgColor = light ? '#FFFFFF' : '#000000';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
    }
    
    // Prepare text rendering
    let fontSize = bold ? 50 : 42; // Starting font size
    const minFontSize = 18; // Minimum font size for very long text
    const fontWeight = bold ? 'bold' : 'normal';
    const textPadding = 50; // Right padding
    
    // Text area starts after avatar - positioned to fit in black area
    const textStartX = flip ? textPadding : 560; // Main quote text position
    const maxTextWidth = width - textStartX - textPadding; // Available width for text (1200 - 560 - 50 = 590px)
    const maxTextHeight = height - 200; // Leave space for author and footer
    
    // Add quotation marks around the text
    const quotedContent = `"${cleanContent}"`;
    
    // Dynamic font sizing - reduce font size if text is too long
    let lines;
    let lineHeight;
    let textHeight;
    
    while (fontSize >= minFontSize) {
        ctx.font = `${fontWeight} ${fontSize}px "DejaVu Sans", "Liberation Sans", Arial, sans-serif`;
        lines = wrapText(ctx, quotedContent, maxTextWidth);
        lineHeight = fontSize * 1.3;
        textHeight = lines.length * lineHeight;
        
        // Check if text fits within available height
        if (textHeight <= maxTextHeight) {
            break;
        }
        
        // Reduce font size and try again
        fontSize -= 2;
    }
    
    // Calculate text positioning (centered vertically)
    const authorHeight = 55;
    const idHeight = 40;
    const totalContentHeight = textHeight + authorHeight + idHeight;
    
    let textY = (height - totalContentHeight) / 2;
    
    // Draw text lines - centered
    ctx.fillStyle = textColor;
    ctx.font = `${fontWeight} ${fontSize}px "DejaVu Sans", "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    const centerX = textStartX + (width - textStartX - textPadding) / 2;
    
    for (const line of lines) {
        ctx.fillText(line, centerX, textY + fontSize);
        textY += lineHeight;
    }
    
    // Draw author name with italic serif font - centered
    textY += 100; // More spacing from main text (moved down more)
    ctx.fillStyle = secondaryColor;
    ctx.font = `italic 32px "DejaVu Serif", "Liberation Serif", Georgia, serif`; // Use italic serif font with Linux fallbacks
    const discriminator = message.author.discriminator === '0' ? '' : `#${message.author.discriminator}`;
    const authorText = `- ${message.author.username}${discriminator}`;
    ctx.textAlign = 'center';
    // centerX already defined above
    ctx.fillText(authorText, centerX, textY); // Center aligned in text area
    
    // Draw message ID - centered
    textY += 29; // More spacing from author name (moved down more)
    ctx.fillStyle = secondaryColor;
    ctx.font = `normal 18px "DejaVu Sans", "Liberation Sans", Arial, sans-serif`;
    ctx.fillText(message.id, centerX, textY); // Center aligned in text area
    
    // Draw footer watermark (bottom right corner)
    const footerText = `Momoify Quotes`;
    ctx.fillStyle = secondaryColor;
    ctx.font = `normal 16px "DejaVu Sans", "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(footerText, width - 20, height - 15);
    
    // Convert to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Create attachment with unique filename to avoid Discord cache
    const timestamp = Date.now();
    return new AttachmentBuilder(buffer, { name: `quote_${timestamp}.png` });
}

/**
 * Parse options from message content and generate quote
 * @param {Message} quotedMessage - The message being quoted
 * @param {string} optionsText - The options text from the mention message
 * @returns {Promise<AttachmentBuilder>} The generated quote image
 */
export async function createQuoteFromMention(quotedMessage, optionsText = '') {
    const options = parseOptions(optionsText);
    return await generateQuote(quotedMessage, options);
}
