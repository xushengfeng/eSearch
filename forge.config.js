module.exports = {
    packagerConfig: {
        icon: "assets/logo/icon",
    },
    makers: [
        {
            name: "@electron-forge/maker-deb",
            config: {
                name: "e-search",
                productName: "eSearch",
                categories: ["Graphics", "System", "Utility"],
                icon: "assets/logo/1024x1024.png",
            },
        },
        {
            name: "@electron-forge/maker-rpm",
            config: {
                name: "e-search",
                productName: "eSearch",
                categories: ["Graphics", "System", "Utility"],
                icon: "assets/logo/1024x1024.png",
            },
        },
        {
            name: "@electron-forge/maker-dmg",
            config: {
                icon: "assets/logo/icon.icns",
                overwrite: true,
            },
        },
    ],
};
