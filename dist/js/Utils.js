"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAVIF = void 0;
/**
 * Tests for AVIF images support in browser.
 */
async function testAVIF() {
    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.onerror = () => reject(false); /* do something */
        image.onload = () => resolve(true); /* do something */
        image.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";
    }).catch(() => false);
    return await promise;
}
exports.testAVIF = testAVIF;
//# sourceMappingURL=Utils.js.map