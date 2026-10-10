import { describe, expect, it } from 'vitest';
import { isPageControllerIcon } from '../../src/home/steamIcons';

describe('isPageControllerIcon', () => {
    // The shape of Steam's game-page controller icon (its export name is minified and changes between Steam builds).
    const steam = 'function Ge(){return(0,n.jsx)("svg",{version:"1.1",id:"Layer_2",className:"SVGIcon_Button SVGIcon_BigPicture",viewBox:"0 0 256 256",children:(0,n.jsx)("path",{fill:"currentColor",d:"M213.771,68.659c-4.108-7.066"})})}';
    it("knows Steam's game-page controller icon by its class and path", () => {
        expect(isPageControllerIcon(steam)).toBe(true);
    });
    it('not another Big Picture icon, nor a long function that merely mentions both', () => {
        expect(isPageControllerIcon(steam.replace('M213.771,68.659', 'M10,10'))).toBe(false);
        expect(isPageControllerIcon(`${steam}${' '.repeat(5000)}`)).toBe(false);
    });
});
