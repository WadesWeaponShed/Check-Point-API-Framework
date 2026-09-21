// Presentation-only extension; existing forms and their listeners remain intact.
const commandPanel = document.querySelector('#commandForm').closest('section.panel');
const scriptPanel = document.querySelector('#scriptForm').closest('section.panel');
const contextPanel = document.querySelector('#contexts').closest('section.panel');
const resultPanel = document.querySelector('.output-panel');
const shell = document.createElement('div');
shell.className = 'workbench';
const navigation = document.createElement('nav');
navigation.className = 'workbench-nav';
navigation.setAttribute('aria-label', 'Workspace Tools');
const heading = document.createElement('h2');
heading.textContent = 'Workspace';
navigation.append(heading);
const content = document.createElement('div');
content.className = 'workbench-content';
for (const [name, panel] of [['API Command Explorer', commandPanel], ['Gaia Run-Script', scriptPanel]]) {
  const button = document.createElement('button');
  button.textContent = name;
  button.type = 'button';
  button.addEventListener('click', () => {
    commandPanel.classList.toggle('hidden', panel !== commandPanel);
    scriptPanel.classList.toggle('hidden', panel !== scriptPanel);
    for (const entry of navigation.querySelectorAll('button')) entry.setAttribute('aria-pressed', String(entry === button));
  });
  navigation.append(button);
}
navigation.append(contextPanel);
content.append(commandPanel, scriptPanel, resultPanel);
shell.append(navigation, content);
document.querySelector('#workspace').append(shell);
navigation.querySelector('button').click();
const loginHeading = document.createElement('div');
loginHeading.className = 'full-row';
const title = document.createElement('h2');
title.textContent = 'Connect to Your Environment';
loginHeading.append(title);
document.querySelector('#loginForm').prepend(loginHeading);
